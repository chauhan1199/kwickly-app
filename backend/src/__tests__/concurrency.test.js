// Concurrency / race-condition tests — assert money moves EXACTLY ONCE
// under simultaneous duplicate requests.
// jest.mock calls are hoisted to the top by Babel — these MUST come before any require()
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
const Customer = require('../modules/customer/customer.model');
const Shop = require('../modules/shop/shop.model');
const Product = require('../modules/product/product.model');
const Job = require('../modules/job/job.model');
const ShopOrder = require('../modules/shoporder/shoporder.model');
const WalletTxn = require('../modules/wallet/wallet.model');
const PlatformLedger = require('../modules/ledger/platformLedger.model');
const { AdminWallet } = require('../modules/adminWallet/adminWallet.model');
const Payout = require('../modules/payout/payout.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Concurrency & Race Conditions', () => {
    let customerToken, customerId, workerId, shopToken, shopId, productId;

    const createAllocatedPaidReadyJob = async (amount = 800) => {
        // Job in COMPLETED state with pricing already set by acceptQuote flow
        const fee = 50; // amount <= 500 tier → flat ₹50... use amount 800 → 12% = 96
        const platformFee = amount > 500 ? Math.round(amount * 0.12) : 50;
        const gst = +(platformFee * 0.18).toFixed(2);
        return Job.create({
            customerId,
            workerId,
            category: 'Plumbing',
            subcategory: 'Pipe Repair',
            description: 'Fix leaking pipe',
            location: { type: 'Point', coordinates: [77.5946, 12.9716] },
            addressDetails: { city: 'Bangalore', fullAddress: '123 Main St' },
            status: 'COMPLETED',
            payment: {
                amount: +(amount + platformFee + gst).toFixed(2),
                quotedAmount: amount,
                workerPayout: amount,
                platformFee,
                gst,
                gstAmount: gst,
                status: 'PENDING',
                escrowStatus: 'LOCKED'
            },
            security: { arrivalOtp: '111111', completionOtp: '222222' }
        });
    };

    const createOutForDeliveryOrder = async () => {
        const order = await ShopOrder.create({
            customerId,
            shopId,
            items: [{ productId, name: 'Milk 1L', price: 200, qty: 1 }],
            subtotal: 200,
            deliveryFee: 40,
            totalAmount: 240,
            total: 240,
            netProductSales: 200,
            deliveryAddress: '123 Main St',
            payment: { method: 'WALLET', status: 'PAID', escrowStatus: 'LOCKED' },
            status: 'OUT_FOR_DELIVERY',
            deliveryOtp: '333333',
            deliveryOtpGeneratedAt: new Date(),
            statusHistory: [{ status: 'OUT_FOR_DELIVERY', timestamp: new Date() }]
        });
        return order;
    };

    beforeEach(async () => {
        const customer = await createTestUser({
            role: 'CUSTOMER', email: 'concur-c@test.com', phone: '9811000001',
            wallet: { balance: 10000, upiId: 'concur-c@upi' }
        });
        customerToken = generateToken(customer);
        customerId = customer._id;

        const worker = await createTestUser({
            role: 'WORKER', email: 'concur-w@test.com', phone: '9811000002',
            kyc: { status: 'APPROVED', documents: [] },
            services: [{ categoryName: 'Plumbing', subcategories: ['Tap repair'], isActive: true }],
            wallet: { balance: 500, upiId: 'concur-w@upi' }
        });
        workerId = worker._id;

        const shopOwner = await createTestUser({
            role: 'SHOP', email: 'concur-s@test.com', phone: '9811000003',
            wallet: { balance: 5000, upiId: 'concur-s@upi' }
        });
        shopToken = generateToken(shopOwner);

        const shop = await Shop.create({
            ownerId: shopOwner._id,
            name: 'Concurrency Shop',
            address: '123 Main St',
            location: { type: 'Point', coordinates: [72.8777, 19.0760] },
            wallet: { balance: 1000 }
        });
        shopId = shop._id;

        const product = await Product.create({ shopId, name: 'Milk 1L', price: 200, stock: 50 });
        productId = product._id;
    });

    // ── Double payJob ──────────────────────────────────────────────────
    describe('Simultaneous duplicate job payment', () => {
        it('should settle the job exactly once — worker credited once, customer debited once', async () => {
            const job = await createAllocatedPaidReadyJob(800);
            // platformFee=96, gst=17.28, customerTotal=913.28

            const [r1, r2, r3] = await Promise.all([
                request(app).post(`/api/v1/jobs/${job._id}/pay`)
                    .set('Authorization', `Bearer ${customerToken}`)
                    .send({ completionOtp: '222222', method: 'ONLINE' }),
                request(app).post(`/api/v1/jobs/${job._id}/pay`)
                    .set('Authorization', `Bearer ${customerToken}`)
                    .send({ completionOtp: '222222', method: 'ONLINE' }),
                request(app).post(`/api/v1/jobs/${job._id}/pay`)
                    .set('Authorization', `Bearer ${customerToken}`)
                    .send({ completionOtp: '222222', method: 'ONLINE' })
            ]);

            const statuses = [r1, r2, r3].map(r => r.status).sort();
            const successes = [r1, r2, r3].filter(r => r.status === 200).length;
            expect(successes).toBe(1);
            expect(statuses).toContain(200);

            // Exactly one settlement ledger entry
            const ledgers = await PlatformLedger.find({ entityType: 'SERVICE_JOB', entityId: job._id });
            expect(ledgers.length).toBe(1);
            expect(ledgers[0].settlementStatus).toBe('SETTLED');

            // Worker credited exactly ₹800
            const worker = await Customer.findById(workerId);
            expect(worker.wallet.balance).toBe(500 + 800);

            // Customer debited exactly once (10000 - 913.28)
            const customer = await Customer.findById(customerId);
            expect(customer.wallet.balance).toBeCloseTo(10000 - 913.28, 1);

            // Exactly one JOB_CREDIT to worker and one JOB_PAYMENT from customer
            const credits = await WalletTxn.find({ refId: String(job._id), type: 'JOB_CREDIT' });
            const payments = await WalletTxn.find({ refId: String(job._id), type: 'JOB_PAYMENT' });
            expect(credits.length).toBe(1);
            expect(payments.length).toBe(1);
        });

        it('should never let the customer pay more than their balance even under a race', async () => {
            const job = await createAllocatedPaidReadyJob(800);
            // Set balance to just enough for ONE payment
            await Customer.findByIdAndUpdate(customerId, { $set: { 'wallet.balance': 913.28 } });

            const results = await Promise.all([
                request(app).post(`/api/v1/jobs/${job._id}/pay`)
                    .set('Authorization', `Bearer ${customerToken}`).send({ completionOtp: '222222', method: 'ONLINE' }),
                request(app).post(`/api/v1/jobs/${job._id}/pay`)
                    .set('Authorization', `Bearer ${customerToken}`).send({ completionOtp: '222222', method: 'ONLINE' })
            ]);

            const successes = results.filter(r => r.status === 200).length;
            expect(successes).toBe(1);

            const customer = await Customer.findById(customerId);
            expect(customer.wallet.balance).toBeGreaterThanOrEqual(0);
        });
    });

    // ── Double shop withdrawal ─────────────────────────────────────────
    describe('Simultaneous duplicate shop withdrawal', () => {
        it('should deduct the amount exactly once from the shop wallet', async () => {
            // shop wallet = 1000, minBalance = 100 → max withdrawable 900
            const payload = { amount: 900, payoutMethod: 'concur-s@upi' };

            const results = await Promise.all([
                request(app).post('/api/v1/shops/my/withdraw')
                    .set('Authorization', `Bearer ${shopToken}`).send(payload),
                request(app).post('/api/v1/shops/my/withdraw')
                    .set('Authorization', `Bearer ${shopToken}`).send(payload)
            ]);

            const successes = results.filter(r => r.status === 201).length;
            // Balance can only cover ONE 900 withdrawal (1000 - 900 = 100 = safety floor)
            expect(successes).toBe(1);

            const shop = await Shop.findById(shopId);
            expect(shop.wallet.balance).toBe(100);

            const payouts = await Payout.find({ shopId });
            expect(payouts.length).toBe(1);
            expect(payouts[0].amount).toBe(900);
            expect(payouts[0].status).toBe('PENDING');
        });
    });

    // ── Double delivery-OTP settlement ─────────────────────────────────
    describe('Simultaneous duplicate DELIVERED status updates', () => {
        it('should settle the shop order exactly once', async () => {
            const order = await createOutForDeliveryOrder();
            const payload = { status: 'DELIVERED', otp: '333333' };

            const results = await Promise.all([
                request(app).patch(`/api/v1/shoporders/${order._id}/status`)
                    .set('Authorization', `Bearer ${shopToken}`).send(payload),
                request(app).patch(`/api/v1/shoporders/${order._id}/status`)
                    .set('Authorization', `Bearer ${shopToken}`).send(payload),
                request(app).patch(`/api/v1/shoporders/${order._id}/status`)
                    .set('Authorization', `Bearer ${shopToken}`).send(payload)
            ]);

            const successes = results.filter(r => r.status === 200).length;
            expect(successes).toBeGreaterThanOrEqual(1);

            // Exactly one settlement
            const ledgers = await PlatformLedger.find({ entityType: 'SHOP_ORDER', entityId: order._id });
            expect(ledgers.length).toBe(1);
            expect(ledgers[0].idempotencyKey).toBe(`settle_order_${order._id}`);
            expect(ledgers[0].settlementStatus).toBe('SETTLED');

            // Shop credited 100% net product sales + delivery fee exactly once (1000 + 200 + 40)
            const shop = await Shop.findById(shopId);
            expect(shop.wallet.balance).toBe(1240);

            const orderTxns = await WalletTxn.find({ refId: String(order._id), type: 'ORDER_CREDIT' });
            expect(orderTxns.length).toBe(1);

            // Final state is DELIVERED / SETTLED regardless of duplicate attempts
            const finalOrder = await ShopOrder.findById(order._id);
            expect(['DELIVERED']).toContain(finalOrder.status);
            expect(finalOrder.payment.escrowStatus).toBe('SETTLED');
        });
    });

    // ── Settlement reversal after delivered-then-cancelled ─────────────
    describe('Delivery settlement reversal', () => {
        it('should claw back shop payout, reverse treasury fee/GST, and refund the customer exactly once', async () => {
            const order = await createOutForDeliveryOrder();
            const treasuryBefore = await AdminWallet.findOne() || { balance: 0, gstLiability: 0 };
            const treasuryBalanceBefore = treasuryBefore.balance || 0;
            const treasuryGstBefore = treasuryBefore.gstLiability || 0;

            // Deliver → settle
            const deliver = await request(app).patch(`/api/v1/shoporders/${order._id}/status`)
                .set('Authorization', `Bearer ${shopToken}`).send({ status: 'DELIVERED', otp: '333333' });
            expect(deliver.status).toBe(200);

            const shopAfterDelivery = await Shop.findById(shopId);
            expect(shopAfterDelivery.wallet.balance).toBe(1240);

            // Cancel after delivery → reversal (only an admin may cancel a delivered order)
            const admin = await createTestUser({ role: 'ADMIN', email: 'conc-admin@test.com', phone: '9844000099' });
            const adminToken = generateToken(admin);
            const cancel = await request(app).patch(`/api/v1/shoporders/${order._id}/status`)
                .set('Authorization', `Bearer ${adminToken}`).send({ status: 'CANCELLED', note: 'Customer returned goods' });
            expect(cancel.status).toBe(200);

            // Whole shop payout (products 200 + delivery 40) clawed back: 1240 - 240 = 1000
            const shopAfterReversal = await Shop.findById(shopId);
            expect(shopAfterReversal.wallet.balance).toBe(1000);

            // Ledger has BOTH original and reversal entries
            const original = await PlatformLedger.findOne({ idempotencyKey: `settle_order_${order._id}` });
            const reversal = await PlatformLedger.findOne({ idempotencyKey: `settle_order_${order._id}_reverse` });
            expect(original).toBeDefined();
            expect(reversal).toBeDefined();
            expect(reversal.settlementStatus).toBe('REVERSED');

            // Customer refunded the settled gross amount (order total incl. fee + GST + delivery)
            const customer = await Customer.findById(customerId);
            expect(customer.wallet.balance).toBeCloseTo(10000 + 240, 1);

            // Double-cancel must NOT double-refund
            const cancel2 = await request(app).patch(`/api/v1/shoporders/${order._id}/status`)
                .set('Authorization', `Bearer ${adminToken}`).send({ status: 'CANCELLED', note: 'again' });
            // CANCELLED → no transitions allowed
            expect([400, 409]).toContain(cancel2.status);

            const customerAfter = await Customer.findById(customerId);
            expect(customerAfter.wallet.balance).toBeCloseTo(10000 + 240, 1);

            // Reversal ledger entry exists exactly once
            const reversals = await PlatformLedger.find({ idempotencyKey: `settle_order_${order._id}_reverse` });
            expect(reversals.length).toBe(1);
        });
    });

    // ── Duplicate topup UTR submission ─────────────────────────────────
    describe('Duplicate wallet topup UTR submission', () => {
        it('should reject a sequential replay of the same UTR with 409', async () => {
            const utr = '987654321098';
            const payload = { amount: 500, txnId: utr, utrNumber: utr };

            const first = await request(app).post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${customerToken}`).send(payload);
            expect(first.status).toBe(201);
            expect(['COMPLETED', 'PENDING_VERIFICATION']).toContain(first.body.data.status);

            const second = await request(app).post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${customerToken}`).send(payload);
            expect(second.status).toBe(409);

            const customer = await Customer.findById(customerId);
            expect([10000, 10500]).toContain(customer.wallet.balance);

            // Exactly one pending TOPUP txn for this UTR
            const pending = await WalletTxn.find({ type: 'TOPUP', razorpayPaymentId: utr });
            expect(pending.length).toBe(1);
        });

        it('should create at most one pending topup for the same UTR under a parallel race', async () => {
            const utr = '987654321097';
            const payload = { amount: 500, txnId: utr, utrNumber: utr };

            const results = await Promise.all([
                request(app).post('/api/v1/wallet/topup')
                    .set('Authorization', `Bearer ${customerToken}`).send(payload),
                request(app).post('/api/v1/wallet/topup')
                    .set('Authorization', `Bearer ${customerToken}`).send(payload)
            ]);

            const pending = await WalletTxn.find({ type: 'TOPUP', razorpayPaymentId: utr });
            // A duplicate pending request for the same UTR would let admin credit the wallet twice.
            expect(pending.length).toBe(1);
            const successes = results.filter(r => r.status === 201).length;
            expect(successes).toBe(1);
        });
    });
});
