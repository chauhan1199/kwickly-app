// Cross-flow UTR anti-replay tests — a single bank transaction (one UTR) must
// never be redeemed twice across wallet topups, job/order payments, and
// worker/shop subscriptions.
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

const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const AppSettings = require('../modules/settings/settings.model');
const WalletTxn = require('../modules/wallet/wallet.model');
const Payment = require('../modules/payment/payment.model');
const { WorkerSubscription, ShopSubscription } = require('../modules/subscription/subscription.model');
const Shop = require('../modules/shop/shop.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Cross-flow UTR Anti-Replay', () => {
    let customerToken, workerToken, shopToken, shopId;
    const seedPlans = async () => {
        await AppSettings.create({
            isSingleton: 'CONFIG',
            subscriptionPlans: [
                { id: 'worker_monthly', label: 'Worker Monthly', price: 299, durationDays: 30, isActive: true, targetRole: 'WORKER' },
                { id: 'shop_monthly', label: 'Shop Monthly', price: 499, durationDays: 30, isActive: true, targetRole: 'SHOP' }
            ]
        });
    };

    beforeEach(async () => {
        await seedPlans();
        const customer = await createTestUser({ role: 'CUSTOMER', email: 'utr-c@test.com', phone: '9822000001', wallet: { balance: 1000 } });
        customerToken = generateToken(customer);

        const worker = await createTestUser({
            role: 'WORKER', email: 'utr-w@test.com', phone: '9822000002',
            kyc: { status: 'APPROVED', documents: [] },
            wallet: { balance: 2000 }
        });
        workerToken = generateToken(worker);

        const shopOwner = await createTestUser({ role: 'SHOP', email: 'utr-s@test.com', phone: '9822000003', wallet: { balance: 2000 } });
        shopToken = generateToken(shopOwner);

        const shop = await Shop.create({
            ownerId: shopOwner._id,
            name: 'UTR Test Shop',
            address: '123 Main St',
            location: { type: 'Point', coordinates: [72.8777, 19.0760] }
        });
        shopId = shop._id;
    });

    describe('UTR consumed by a wallet topup', () => {
        it('cannot be reused for another wallet topup', async () => {
            const utr = '987650000001';
            const first = await request(app).post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 500, utrNumber: utr });
            expect(first.status).toBe(201);

            const second = await request(app).post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 500, utrNumber: utr });
            expect(second.status).toBe(409);
        });

        it('cannot be reused for a worker subscription', async () => {
            const utr = '987650000002';
            await request(app).post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ amount: 299, utrNumber: utr });

            const sub = await request(app).post('/api/v1/subscriptions/subscribe')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ planId: 'worker_monthly', targetRole: 'WORKER', utrNumber: utr });
            expect(sub.status).toBe(409);

            // No subscription doc created
            const subs = await WorkerSubscription.find({});
            expect(subs.length).toBe(0);
        });

        it('cannot be reused for a shop subscription', async () => {
            const utr = '987650000003';
            await request(app).post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ amount: 499, utrNumber: utr });

            const sub = await request(app).post('/api/v1/subscriptions/subscribe')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ planId: 'shop_monthly', targetRole: 'SHOP', utrNumber: utr });
            expect(sub.status).toBe(409);

            const subs = await ShopSubscription.find({});
            expect(subs.length).toBe(0);
        });

        it('cannot be reused for a payment verification (even while still PENDING)', async () => {
            const utr = '987650000004';
            // Topup creates a PENDING (not yet COMPLETED) txn — replay must still be blocked
            await request(app).post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 500, utrNumber: utr });

            const verify = await request(app).post('/api/v1/payments/verify')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ razorpayOrderId: 'upi_ord_test_1', utrNumber: utr, amount: 240 });
            expect(verify.status).toBe(409);
        });
    });

    describe('UTR consumed by a payment', () => {
        it('cannot be reused for a wallet topup', async () => {
            const utr = '987651000001';
            // Submit a payment verification (goes to PENDING_VERIFICATION — nothing captured yet)
            const verify = await request(app).post('/api/v1/payments/verify')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ razorpayOrderId: 'upi_ord_test_2', utrNumber: utr, amount: 240 });
            expect(verify.status).toBe(200);
            expect(['PENDING', 'PENDING_VERIFICATION', 'COMPLETED']).toContain(verify.body.data.status);

            const topup = await request(app).post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 500, utrNumber: utr });
            expect(topup.status).toBe(409);
        });

        it('cannot be reused for a worker subscription', async () => {
            const utr = '987651000002';
            await request(app).post('/api/v1/payments/verify')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ razorpayOrderId: 'upi_ord_test_3', utrNumber: utr, amount: 240 });

            const sub = await request(app).post('/api/v1/subscriptions/subscribe')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ planId: 'worker_monthly', targetRole: 'WORKER', utrNumber: utr });
            expect(sub.status).toBe(409);
        });
    });

    describe('UTR consumed by a subscription', () => {
        it('cannot be reused for a wallet topup', async () => {
            const utr = '987652000001';
            const sub = await request(app).post('/api/v1/subscriptions/subscribe')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ planId: 'worker_monthly', targetRole: 'WORKER', utrNumber: utr });
            expect([200, 201]).toContain(sub.status);

            const topup = await request(app).post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ amount: 500, utrNumber: utr });
            expect(topup.status).toBe(409);
        });

        it('cannot be reused for a payment verification', async () => {
            const utr = '987652000002';
            await request(app).post('/api/v1/subscriptions/subscribe')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ planId: 'worker_monthly', targetRole: 'WORKER', utrNumber: utr });

            const verify = await request(app).post('/api/v1/payments/verify')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ razorpayOrderId: 'upi_ord_test_4', utrNumber: utr, amount: 240 });
            expect(verify.status).toBe(409);
        });

        it('cannot be reused for a second subscription', async () => {
            const utr = '987652000003';
            await request(app).post('/api/v1/subscriptions/subscribe')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ planId: 'worker_monthly', targetRole: 'WORKER', utrNumber: utr });

            const again = await request(app).post('/api/v1/subscriptions/subscribe')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ planId: 'worker_monthly', targetRole: 'WORKER', utrNumber: utr });
            expect(again.status).toBe(409);
        });
    });

    describe('distinct UTRs are independent', () => {
        it('allows different users to submit different UTRs without false conflicts', async () => {
            const r1 = await request(app).post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 500, utrNumber: '987653000001' });
            const r2 = await request(app).post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ amount: 500, utrNumber: '987653000002' });
            expect(r1.status).toBe(201);
            expect(r2.status).toBe(201);
        });
    });
});
