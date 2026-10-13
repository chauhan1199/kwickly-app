jest.mock('../helpers/redis.helper', () => ({
    initRedis: jest.fn(),
    getRedis: jest.fn(),
    setCache: jest.fn(),
    getCache: jest.fn(),
    delCache: jest.fn(),
    delCacheByPattern: jest.fn(),
    fetchWithCache: jest.fn(),
    acquireLock: jest.fn().mockResolvedValue('mock-holder-id'),
    releaseLock: jest.fn()
}));

jest.mock('../middleware/rateLimit.middleware', () => {
    const passThrough = (req, res, next) => next();
    return { globalLimiter: passThrough, authLimiter: passThrough, otpSendLimiter: passThrough };
});

jest.mock('../helpers/socket.helper', () => ({
    initSocket: jest.fn(),
    getIO: jest.fn(),
    emitToAll: jest.fn(),
    emitToRoom: jest.fn(),
    triggerDashboardUpdate: jest.fn(),
    emitToUser: jest.fn()
}));

jest.mock('../services/sms.service', () => ({
    sendOTP: jest.fn().mockResolvedValue('1234')
}));

const BankCredit = require('../modules/payment/bankCredit.model');
const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const AppSettings = require('../modules/settings/settings.model');
const WalletTxn = require('../modules/wallet/wallet.model');
const { WorkerSubscription, ShopSubscription } = require('../modules/subscription/subscription.model');
const Shop = require('../modules/shop/shop.model');
const Customer = require('../modules/customer/customer.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Shop & Worker Wallet Top-Up and Automated Subscription Lifecycle', () => {
    let customerUser, customerToken;
    let workerUser, workerToken;
    let shopOwnerUser, shopToken, shopDoc;

    const seedConfig = async () => {
        await AppSettings.create({
            isSingleton: 'CONFIG',
            subscriptionPlans: [
                { id: 'worker_pro', label: 'Worker Pro Monthly', price: 299, durationDays: 30, isActive: true, targetRole: 'WORKER' },
                { id: 'shop_starter', label: 'Shop Starter Monthly', price: 499, durationDays: 30, isActive: true, targetRole: 'SHOP' },
                { id: 'shop_enterprise', label: 'Shop Enterprise 90 Days', price: 1299, durationDays: 90, isActive: true, targetRole: 'SHOP' }
            ]
        });
    };

    beforeEach(async () => {
        await seedConfig();

        customerUser = await createTestUser({
            role: 'CUSTOMER',
            email: 'cust_auto@test.com',
            phone: '9900000001',
            wallet: { balance: 100 }
        });
        customerToken = generateToken(customerUser);

        workerUser = await createTestUser({
            role: 'WORKER',
            email: 'work_auto@test.com',
            phone: '9900000002',
            kyc: { status: 'APPROVED', documents: [] },
            wallet: { balance: 250 }
        });
        workerToken = generateToken(workerUser);

        shopOwnerUser = await createTestUser({
            role: 'SHOP',
            email: 'shop_auto@test.com',
            phone: '9900000003',
            wallet: { balance: 0 }
        });
        shopToken = generateToken(shopOwnerUser);

        shopDoc = await Shop.create({
            ownerId: shopOwnerUser._id,
            name: 'Auto Tech Store',
            address: '42 MG Road, Bengaluru',
            location: { type: 'Point', coordinates: [77.5946, 12.9716] },
            wallet: { balance: 500 }
        });
    });

    describe('Shop Wallet Top-up with Direct Verified UTR', () => {
        it('should credit Shop.wallet.balance atomically and create COMPLETED transaction', async () => {
            const utr = '812345678901';
            // The bank-SMS webhook has already recorded this credit
            await BankCredit.create({ utr, amount: 500, source: 'BANK_SMS', receivedAt: new Date(), isClaimed: false });
            const res = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({
                    amount: 500,
                    utrNumber: utr
                });

            expect(res.status).toBe(201);
            expect(res.body.data.status).toBe('COMPLETED');
            expect(res.body.data.amount).toBe(500);
            expect(res.body.data.newBalance).toBe(1000); // 500 initial + 500 top-up

            // Verify database state
            const updatedShop = await Shop.findById(shopDoc._id);
            expect(updatedShop.wallet.balance).toBe(1000);

            const txn = await WalletTxn.findOne({ razorpayPaymentId: utr });
            expect(txn).toBeDefined();
            expect(txn.status).toBe('COMPLETED');
            expect(txn.amount).toBe(500);
            expect(txn.balance).toBe(1000);
        });

        it('should reject malformed UTR with bad request (less than 12 digits)', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({
                    amount: 200,
                    utrNumber: '12345'
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/Invalid UTR format/i);
        });

        it('should prevent replay of the same UTR across shop wallet top-ups', async () => {
            const utr = '812345678902';
            const first = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ amount: 300, utrNumber: utr });
            expect(first.status).toBe(201);

            const second = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ amount: 300, utrNumber: utr });
            expect(second.status).toBe(409);
            expect(second.body.message).toMatch(/already been redeemed/i);
        });
    });

    describe('Top-up with a UTR the bank has not confirmed', () => {
        it('should hold it PENDING_VERIFICATION and leave the balance unchanged', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ amount: 50000, utrNumber: '873519246081' });

            expect(res.status).toBe(201);
            expect(res.body.data.status).toBe('PENDING_VERIFICATION');
            const shop = await Shop.findById(shopDoc._id).lean();
            expect(shop.wallet.balance).toBe(500);
        });

        it('should not activate a subscription without a bank-confirmed payment', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ amount: 299, planId: 'worker_pro', utrNumber: '873519246082' });

            expect(res.body.data.status).toBe('PENDING_VERIFICATION');
            const worker = await Customer.findById(workerUser._id).lean();
            expect(worker.subscription?.planId).not.toBe('worker_pro');
        });
    });

    describe('Shop Subscription Purchase via Direct UPI Top-up Flow', () => {
        it('should activate Shop subscription atomically and create ShopSubscription record', async () => {
            const utr = '812345678903';
            // The bank-SMS webhook has already recorded this credit
            await BankCredit.create({ utr, amount: 499, source: 'BANK_SMS', receivedAt: new Date(), isClaimed: false });
            const res = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({
                    amount: 499,
                    planId: 'shop_starter',
                    utrNumber: utr
                });

            expect(res.status).toBe(201);
            expect(res.body.data.status).toBe('COMPLETED');

            // Verify Shop record has active subscription
            const updatedShop = await Shop.findById(shopDoc._id);
            expect(updatedShop.subscription.planId).toBe('shop_starter');
            expect(updatedShop.subscription.expiryDate).toBeDefined();
            expect(new Date(updatedShop.subscription.expiryDate).getTime()).toBeGreaterThan(Date.now());

            // Verify ShopSubscription record created
            const subRecord = await ShopSubscription.findOne({ shopId: shopDoc._id, planId: 'shop_starter' });
            expect(subRecord).toBeDefined();
            expect(subRecord.payment.status).toBe('PAID');
            expect(subRecord.payment.razorpayPaymentId).toBe(utr);
        });

        it('should reject subscription purchase if amount does not match plan price', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({
                    amount: 300, // Correct price is 499
                    planId: 'shop_starter',
                    utrNumber: '812345678904'
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/must exactly match the plan price of ₹499/i);
        });

        it('should reject subscription purchase if planId is invalid', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({
                    amount: 499,
                    planId: 'non_existent_plan',
                    utrNumber: '812345678905'
                });

            expect(res.status).toBe(404);
            expect(res.body.message).toMatch(/Subscription plan not found/i);
        });
    });

    describe('Worker Subscription Purchase via Direct UPI Top-up Flow', () => {
        it('should activate Worker subscription atomically and update Customer.subscription', async () => {
            const utr = '812345678906';
            // The bank-SMS webhook has already recorded this credit
            await BankCredit.create({ utr, amount: 299, source: 'BANK_SMS', receivedAt: new Date(), isClaimed: false });
            const res = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({
                    amount: 299,
                    planId: 'worker_pro',
                    utrNumber: utr
                });

            expect(res.status).toBe(201);
            expect(res.body.data.status).toBe('COMPLETED');

            // Verify Worker record has active subscription
            const updatedWorker = await Customer.findById(workerUser._id);
            expect(updatedWorker.subscription.planId).toBe('worker_pro');
            expect(updatedWorker.subscription.expiryDate).toBeDefined();
            expect(new Date(updatedWorker.subscription.expiryDate).getTime()).toBeGreaterThan(Date.now());

            // Verify WorkerSubscription record created
            const subRecord = await WorkerSubscription.findOne({ workerId: workerUser._id, planId: 'worker_pro' });
            expect(subRecord).toBeDefined();
            expect(subRecord.payment.status).toBe('PAID');
            expect(subRecord.payment.razorpayPaymentId).toBe(utr);
        });
    });

    describe('Intent Registration Mode (No UTR initially)', () => {
        it('should return PENDING status with upiIntentUri for 1-tap app launch', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({
                    amount: 1000
                });

            expect(res.status).toBe(201);
            expect(res.body.data.status).toBe('PENDING');
            expect(res.body.data.upiIntentUri).toBeDefined();
            expect(res.body.data.upiIntentUri).toMatch(/^upi:\/\/pay/);
            expect(res.body.data.amount).toBe(1000);

            // Verify a PENDING WalletTxn is in the database
            const txn = await WalletTxn.findById(res.body.data.txnId);
            expect(txn).toBeDefined();
            expect(txn.status).toBe('PENDING');
        });
    });

    describe('GET /api/v1/wallet/balance for Shop Owner', () => {
        it('should correctly return shop wallet balance for shop owner role', async () => {
            const res = await request(app)
                .get('/api/v1/wallet/balance')
                .set('Authorization', `Bearer ${shopToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.balance).toBe(500);
            expect(res.body.data.transactions).toBeDefined();
        });
    });
});
