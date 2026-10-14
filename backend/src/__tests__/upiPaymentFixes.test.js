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
const BankCredit = require('../modules/payment/bankCredit.model');
const Shop = require('../modules/shop/shop.model');
const Customer = require('../modules/customer/customer.model');
const { ShopSubscription } = require('../modules/subscription/subscription.model');
const { handleWalletTopupWebhook } = require('../helpers/webhookHandlers.helper');
const { parseBankCreditSms, extractSmsAmount } = require('../helpers/upi.helper');
const socket = require('../helpers/socket.helper');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); jest.clearAllMocks(); }, 10000);

const balanceOf = async (id) => (await Customer.findById(id).lean()).wallet.balance;

describe('Direct-UPI payment fixes', () => {
    let customer, customerToken, worker, admin, adminToken, shopOwner, shopToken;

    beforeEach(async () => {
        await AppSettings.create({
            isSingleton: 'CONFIG',
            subscriptionPlans: [
                { id: 'worker_pro', label: 'Worker Pro', price: 299, durationDays: 30, isActive: true, targetRole: 'WORKER' },
                { id: 'shop_starter', label: 'Shop Starter', price: 499, durationDays: 30, isActive: true, targetRole: 'SHOP' }
            ]
        });
        customer = await createTestUser({ role: 'CUSTOMER', email: 'c@t.com', phone: '9800000001', wallet: { balance: 100 } });
        customerToken = generateToken(customer);
        worker = await createTestUser({ role: 'WORKER', email: 'w@t.com', phone: '9800000002', wallet: { balance: 250 } });
        admin = await createTestUser({ role: 'ADMIN', email: 'a@t.com', phone: '9800000003' });
        adminToken = generateToken(admin);
        shopOwner = await createTestUser({ role: 'SHOP', email: 's@t.com', phone: '9800000004', wallet: { balance: 0 } });
        shopToken = generateToken(shopOwner);
        await Shop.create({
            ownerId: shopOwner._id, name: 'Fix Store', address: '1 Road',
            location: { type: 'Point', coordinates: [77.59, 12.97] }, wallet: { balance: 500 }
        });
    });

    describe('#1 no amount-only matching', () => {
        it('does not credit a pending top-up or a CREATED shop_order Payment that only shares the amount', async () => {
            const txn = await WalletTxn.create({ userId: customer._id, type: 'TOPUP', amount: 500, balance: 100, status: 'PENDING', razorpayPaymentId: '412345678901' });
            await Payment.create({ userId: customer._id, amount: 500, status: 'CREATED', razorpayOrderId: 'upi_ord_x', metadata: { notes: { purpose: 'shop_order' } } });

            await handleWalletTopupWebhook({ amount: 500, utr: '598765432109' }, '598765432109');

            expect((await WalletTxn.findById(txn._id)).status).toBe('PENDING');
            expect(await balanceOf(customer._id)).toBe(100);
            expect((await Payment.findOne({ razorpayOrderId: 'upi_ord_x' })).status).toBe('CREATED');
            expect(await WalletTxn.countDocuments({ status: 'COMPLETED' })).toBe(0);
        });
    });

    describe('#2 UTR match requires matching amount and credits the bank amount', () => {
        it('holds a UTR match whose bank amount differs by more than ₹0.50', async () => {
            const txn = await WalletTxn.create({ userId: customer._id, type: 'TOPUP', amount: 5000, balance: 100, status: 'PENDING', razorpayPaymentId: '412345678901' });
            await BankCredit.create({ utr: '412345678901', amount: 50, isClaimed: false });
            await handleWalletTopupWebhook({ amount: 50, utr: '412345678901' }, '412345678901');
            expect((await WalletTxn.findById(txn._id)).status).toBe('PENDING');
            expect(await balanceOf(customer._id)).toBe(100);
            expect((await BankCredit.findOne({ utr: '412345678901' })).isClaimed).toBe(false);
        });

        it('credits the SMS amount once and claims the BankCredit', async () => {
            const txn = await WalletTxn.create({ userId: customer._id, type: 'TOPUP', amount: 500, balance: 100, status: 'PENDING', razorpayPaymentId: '412345678901' });
            await BankCredit.create({ utr: '412345678901', amount: 499.6, isClaimed: false });
            await handleWalletTopupWebhook({ amount: 499.6, utr: '412345678901' }, '412345678901');
            await handleWalletTopupWebhook({ amount: 499.6, utr: '412345678901' }, '412345678901');

            const done = await WalletTxn.findById(txn._id);
            expect(done.status).toBe('COMPLETED');
            expect(done.amount).toBeCloseTo(499.6);
            expect(await balanceOf(customer._id)).toBeCloseTo(599.6);
            const bc = await BankCredit.findOne({ utr: '412345678901' });
            expect(bc.isClaimed).toBe(true);
            expect(String(bc.claimedBy)).toBe(String(customer._id));
        });

        it('does not credit when the UTR BankCredit was already claimed elsewhere', async () => {
            await WalletTxn.create({ userId: customer._id, type: 'TOPUP', amount: 500, balance: 100, status: 'PENDING', razorpayPaymentId: '412345678901' });
            await BankCredit.create({ utr: '412345678901', amount: 500, isClaimed: true, claimedBy: worker._id });
            await handleWalletTopupWebhook({ amount: 500, utr: '412345678901' }, '412345678901');
            expect(await balanceOf(customer._id)).toBe(100);
        });
    });

    describe('#3/#4 bank SMS parsing', () => {
        it('rejects debit SMS and accepts credit SMS', () => {
            expect(parseBankCreditSms('Rs.500.00 debited from A/c XX12 UPI Ref 412345678901')).toBeNull();
            expect(parseBankCreditSms('Rs 500 sent to SHOP via UPI Ref No 412345678901')).toBeNull();
            expect(parseBankCreditSms('INR 500 paid to Merchant. Ref 412345678901 (credited points)')).toBeNull();
            expect(parseBankCreditSms('Rs 500 withdrawn at ATM, Ref 412345678901')).toBeNull();
            expect(parseBankCreditSms('A/c XX12 credited by Rs.500.00 UPI Ref No 412345678901')).toEqual({ amount: 500, utr: '412345678901' });
            expect(parseBankCreditSms('INR 750 received from RAM UTR 412345678901')).toEqual({ amount: 750, utr: '412345678901' });
            expect(parseBankCreditSms('Rs 300 deposited in your a/c, RRN 412345678901')).toEqual({ amount: 300, utr: '412345678901' });
        });

        it('parses comma amounts with Rs/INR/₹ and ignores the balance', () => {
            expect(parseBankCreditSms('Your A/c credited by Rs.1,500.00 on 12-10. UPI Ref No 412345678901. Avl Bal Rs 25,000.00').amount).toBe(1500);
            expect(parseBankCreditSms('₹12,345.50 credited to a/c XX1 Ref 412345678901').amount).toBe(12345.5);
            expect(parseBankCreditSms('INR 2,000 received UTR 412345678901').amount).toBe(2000);
            expect(extractSmsAmount('Rs.1,500.00 debited from a/c XX12')).toBe(1500);
            expect(extractSmsAmount('₹1,00,000 sent to X')).toBe(100000);
        });
    });

    describe('#5 plan purchase via TOPUP+planId', () => {
        it('activates the worker plan without crediting the wallet', async () => {
            const txn = await WalletTxn.create({ userId: worker._id, type: 'TOPUP', amount: 299, balance: 250, status: 'PENDING', planId: 'worker_pro', razorpayPaymentId: '412345678901' });
            await handleWalletTopupWebhook({ amount: 299, utr: '412345678901' }, '412345678901');

            const w = await Customer.findById(worker._id).lean();
            expect(w.wallet.balance).toBe(250);
            expect(w.subscription.planId).toBe('worker_pro');
            expect(w.subscription.isActive).toBe(true);
            const done = await WalletTxn.findById(txn._id).lean();
            expect(done.status).toBe('COMPLETED');
            expect(done.type).toBe('SUBSCRIPTION');
        });
    });

    describe('#6 admin approve / reject', () => {
        it('credits exactly once on a double approve', async () => {
            const txn = await WalletTxn.create({ userId: customer._id, type: 'TOPUP', amount: 400, balance: 100, status: 'PENDING', razorpayPaymentId: '412345678901' });
            const url = `/api/v1/wallet/pending-topups/${txn._id}/approve`;
            const [r1, r2] = await Promise.all([
                request(app).post(url).set('Authorization', `Bearer ${adminToken}`),
                request(app).post(url).set('Authorization', `Bearer ${adminToken}`)
            ]);
            expect([r1.status, r2.status].sort()).toEqual([200, 400]);
            expect(await balanceOf(customer._id)).toBe(500);
            expect(socket.emitToUser).toHaveBeenCalledWith(customer._id, 'WALLET_UPDATE', expect.objectContaining({ balance: 500 }));
        });

        it('credits Shop.wallet (not Customer.wallet) for a SHOP user', async () => {
            const txn = await WalletTxn.create({ userId: shopOwner._id, type: 'TOPUP', amount: 300, balance: 500, status: 'PENDING', razorpayPaymentId: '412345678901' });
            const res = await request(app).post(`/api/v1/wallet/pending-topups/${txn._id}/approve`).set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect((await Shop.findOne({ ownerId: shopOwner._id }).lean()).wallet.balance).toBe(800);
            expect(await balanceOf(shopOwner._id)).toBe(0);
        });

        it('activates a SHOP plan on approval without a wallet credit', async () => {
            const txn = await WalletTxn.create({ userId: shopOwner._id, type: 'TOPUP', amount: 499, balance: 500, status: 'PENDING', planId: 'shop_starter', razorpayPaymentId: '412345678901' });
            const res = await request(app).post(`/api/v1/wallet/pending-topups/${txn._id}/approve`).set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            const shop = await Shop.findOne({ ownerId: shopOwner._id }).lean();
            expect(shop.wallet.balance).toBe(500);
            expect(shop.subscription.planId).toBe('shop_starter');
            expect(await ShopSubscription.countDocuments({ shopId: shop._id })).toBe(1);
        });

        it('rejects atomically: second reject and a later approve both fail', async () => {
            const txn = await WalletTxn.create({ userId: customer._id, type: 'TOPUP', amount: 400, balance: 100, status: 'PENDING', razorpayPaymentId: '412345678901' });
            const base = `/api/v1/wallet/pending-topups/${txn._id}`;
            const r1 = await request(app).post(`${base}/reject`).set('Authorization', `Bearer ${adminToken}`).send({});
            const r2 = await request(app).post(`${base}/reject`).set('Authorization', `Bearer ${adminToken}`).send({});
            const r3 = await request(app).post(`${base}/approve`).set('Authorization', `Bearer ${adminToken}`);
            expect([r1.status, r2.status, r3.status]).toEqual([200, 400, 400]);
            expect(await balanceOf(customer._id)).toBe(100);
        });
    });

    describe('#12 UPI plan purchases in the admin Subscriptions queue', () => {
        it('lists a pending UPI plan purchase and approving it activates the plan', async () => {
            const sub = await request(app).post('/api/v1/subscriptions/subscribe').set('Authorization', `Bearer ${generateToken(worker)}`)
                .send({ planId: 'worker_pro', targetRole: 'WORKER', paymentMethod: 'UPI', utrNumber: '412345678901' });
            expect(sub.status).toBe(201);
            const list = await request(app).get('/api/v1/subscriptions/pending').set('Authorization', `Bearer ${adminToken}`);
            const item = list.body.data.pending.find(p => p.source === 'WALLET_TXN');
            expect(item).toBeDefined();
            expect(item.payment.razorpayPaymentId).toBe('412345678901');
            const ok = await request(app).post(`/api/v1/subscriptions/pending/${item._id}/approve`).set('Authorization', `Bearer ${adminToken}`);
            expect(ok.status).toBe(200);
            const w = await Customer.findById(worker._id).lean();
            expect(w.subscription.planId).toBe('worker_pro');
            expect(w.wallet.balance).toBe(250);
        });
    });

    describe('#9 GET /payments/status/:ref', () => {
        it('returns 200 for a non-ObjectId payment reference', async () => {
            await Payment.create({ userId: customer._id, amount: 200, status: 'CREATED', razorpayOrderId: 'upi_ord_abc' });
            const res = await request(app).get('/api/v1/payments/status/upi_ord_abc').set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('PENDING');
        });
    });

    describe('#13 pending reuse never overwrites a submitted UTR', () => {
        it('keeps the first UTR when a second same-amount UTR is submitted', async () => {
            const a = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${customerToken}`).send({ amount: 500, utrNumber: '412345678901' });
            const b = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${customerToken}`).send({ amount: 500, utrNumber: '598765432109' });
            expect(a.status).toBe(201);
            expect(b.status).toBe(201);
            expect(await WalletTxn.countDocuments({ razorpayPaymentId: '412345678901', status: 'PENDING' })).toBe(1);
            expect(await WalletTxn.countDocuments({ razorpayPaymentId: '598765432109', status: 'PENDING' })).toBe(1);
        });

        it('submits the UTR against the intent-mode record named by pendingTxnId', async () => {
            const intent = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${customerToken}`).send({ amount: 500 });
            const txnId = intent.body.data.txnId;
            await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${customerToken}`).send({ amount: 500, utrNumber: '412345678901', pendingTxnId: txnId });
            expect((await WalletTxn.findById(txnId)).razorpayPaymentId).toBe('412345678901');
            expect(await WalletTxn.countDocuments({ userId: customer._id })).toBe(1);
        });
    });

    describe('#14 cancelPayment', () => {
        it('refuses to cancel a PENDING_VERIFICATION payment', async () => {
            await Payment.create({ userId: customer._id, amount: 200, status: 'PENDING_VERIFICATION', razorpayOrderId: 'upi_ord_pv', razorpayPaymentId: '412345678901' });
            const res = await request(app).post('/api/v1/payments/cancel').set('Authorization', `Bearer ${customerToken}`).send({ razorpayOrderId: 'upi_ord_pv' });
            expect(res.status).toBe(409);
            expect((await Payment.findOne({ razorpayOrderId: 'upi_ord_pv' })).status).toBe('PENDING_VERIFICATION');
            expect(await WalletTxn.countDocuments({})).toBe(0);
        });

        it('cancels a CREATED shop_order payment with an ORDER_PAYMENT history row', async () => {
            await Payment.create({ userId: customer._id, amount: 200, status: 'CREATED', razorpayOrderId: 'upi_ord_so', metadata: { notes: { purpose: 'shop_order' } } });
            const res = await request(app).post('/api/v1/payments/cancel').set('Authorization', `Bearer ${customerToken}`).send({ razorpayOrderId: 'upi_ord_so' });
            expect(res.status).toBe(200);
            const row = await WalletTxn.findOne({ userId: customer._id }).lean();
            expect(row.type).toBe('ORDER_PAYMENT');
            expect(row.status).toBe('FAILED');
        });
    });
});
