// Regression tests for money-flow bugs found in the 2026-10 audit:
// unverified UPI payments, repeat payment verification, promo limits and
// the cash-job credit limit.

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
const BankCredit = require('../modules/payment/bankCredit.model');
const { Promotion } = require('../modules/promotion/promotion.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Money-flow regression fixes', () => {
    let customer, customerToken, worker, shopOwner, shopToken, otherShopToken, adminToken, shop, product;

    const createCompletedJob = async (amount = 400) => {
        const platformFee = 50;
        const gst = 9;
        return Job.create({
            customerId: customer._id,
            workerId: worker._id,
            category: 'Plumbing',
            subcategory: 'Pipe Repair',
            description: 'Fix leaking pipe',
            location: { type: 'Point', coordinates: [77.5946, 12.9716] },
            addressDetails: { city: 'Bangalore', fullAddress: '123 Main St' },
            status: 'COMPLETED',
            payment: {
                amount: amount + platformFee + gst,
                quotedAmount: amount,
                workerPayout: amount,
                platformFee,
                gst,
                gstAmount: gst,
                status: 'PENDING',
                escrowStatus: 'LOCKED'
            },
            security: { arrivalOtp: '1111', completionOtp: '2222' }
        });
    };

    const createUpiOrder = (overrides = {}) => ShopOrder.create({
        customerId: customer._id,
        shopId: shop._id,
        items: [{ productId: product._id, name: 'Milk 1L', price: 200, qty: 1 }],
        subtotal: 200,
        total: 200,
        deliveryAddress: '123 Main St',
        payment: { method: 'UPI', status: 'PENDING_VERIFICATION', amount: 200, utrNumber: '734251986012' },
        status: 'CONFIRMED',
        statusHistory: [{ status: 'CONFIRMED', timestamp: new Date() }],
        ...overrides
    });

    beforeEach(async () => {
        customer = await createTestUser({
            role: 'CUSTOMER', email: 'ff-c@test.com', phone: '9822000001',
            wallet: { balance: 5000 }
        });
        customerToken = generateToken(customer);

        worker = await createTestUser({
            role: 'WORKER', email: 'ff-w@test.com', phone: '9822000002',
            kyc: { status: 'APPROVED', documents: [] },
            wallet: { balance: 0 }
        });

        shopOwner = await createTestUser({ role: 'SHOP', email: 'ff-s@test.com', phone: '9822000003' });
        shopToken = generateToken(shopOwner);
        const otherOwner = await createTestUser({ role: 'SHOP', email: 'ff-s2@test.com', phone: '9822000004' });
        otherShopToken = generateToken(otherOwner);

        const admin = await createTestUser({ role: 'ADMIN', email: 'ff-a@test.com', phone: '9822000005' });
        adminToken = generateToken(admin);

        shop = await Shop.create({
            ownerId: shopOwner._id,
            name: 'Flow Fix Shop',
            address: '123 Main St',
            location: { type: 'Point', coordinates: [72.8777, 19.0760] },
            isOnline: true,
            kyc: { status: 'APPROVED' },
            deliveryConfig: { deliveryRadiusKm: 5, deliveryCharge: 0, freeDeliveryAbove: 0 }
        });
        await Shop.create({
            ownerId: otherOwner._id,
            name: 'Other Shop',
            address: '9 Side St',
            location: { type: 'Point', coordinates: [72.8777, 19.0760] }
        });
        product = await Product.create({ shopId: shop._id, name: 'Milk 1L', price: 200, stock: 50, isActive: true });
    });

    describe('Order payment via /payments/verify', () => {
        it('keeps the order PENDING_VERIFICATION when no bank credit matches the UTR', async () => {
            const order = await createUpiOrder({ payment: { method: 'UPI', status: 'PENDING', amount: 200 } });
            const res = await request(app)
                .post('/api/v1/payments/verify')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ razorpayOrderId: `upi_ord_${Date.now()}`, orderId: String(order._id), utrNumber: '734251986013' });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('PENDING_VERIFICATION');
            const updated = await ShopOrder.findById(order._id).lean();
            expect(updated.payment.status).toBe('PENDING_VERIFICATION');
        });

        it('marks the order PAID when the bank-SMS webhook already recorded the matching credit', async () => {
            const order = await createUpiOrder({ payment: { method: 'UPI', status: 'PENDING', amount: 200 } });
            await BankCredit.create({ utr: '734251986014', amount: 200, source: 'BANK_SMS', receivedAt: new Date(), isClaimed: false });

            const res = await request(app)
                .post('/api/v1/payments/verify')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ razorpayOrderId: `upi_ord_${Date.now()}`, orderId: String(order._id), utrNumber: '734251986014' });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('PAID');
            const credit = await BankCredit.findOne({ utr: '734251986014' }).lean();
            expect(credit.isClaimed).toBe(true);
        });

        it('does not accept a bank credit for a different amount', async () => {
            const order = await createUpiOrder({ payment: { method: 'UPI', status: 'PENDING', amount: 200 } });
            await BankCredit.create({ utr: '734251986015', amount: 20, source: 'BANK_SMS', receivedAt: new Date(), isClaimed: false });

            const res = await request(app)
                .post('/api/v1/payments/verify')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ razorpayOrderId: `upi_ord_${Date.now()}`, orderId: String(order._id), utrNumber: '734251986015' });

            expect(res.body.data.status).toBe('PENDING_VERIFICATION');
        });
    });

    describe('Placing a UPI shop order', () => {
        const placeUpi = (extra) => request(app)
            .post('/api/v1/shoporders')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                shopId: String(shop._id),
                items: [{ productId: String(product._id), name: 'Milk 1L', price: 200, qty: 1 }],
                deliveryAddress: '123 Main St',
                deliveryLocation: { type: 'Point', coordinates: [72.8777, 19.0760] },
                paymentMethod: 'UPI',
                ...extra
            });

        it('does not trust isPaid and a typed UTR', async () => {
            const res = await placeUpi({ isPaid: true, utrNumber: '734251986021' });

            expect(res.status).toBeLessThan(300);
            const order = await ShopOrder.findOne({ customerId: customer._id }).lean();
            expect(order.payment.status).toBe('PENDING_VERIFICATION');
        });

        it('marks the order PAID when the bank credit for the full total is on record', async () => {
            const first = await placeUpi({});
            const total = first.body.data?.total ?? (await ShopOrder.findOne({ customerId: customer._id }).lean()).total;
            await ShopOrder.deleteMany({});
            await BankCredit.create({ utr: '734251986022', amount: total, source: 'BANK_SMS', receivedAt: new Date(), isClaimed: false });

            const res = await placeUpi({ utrNumber: '734251986022' });

            expect(res.status).toBeLessThan(300);
            const order = await ShopOrder.findOne({ customerId: customer._id }).lean();
            expect(order.payment.status).toBe('PAID');
        });
    });

    describe('POST /shoporders/:id/verify-payment', () => {
        it('rejects a shop verifying another shop\'s order', async () => {
            const order = await createUpiOrder();
            const res = await request(app)
                .post(`/api/v1/shoporders/${order._id}/verify-payment`)
                .set('Authorization', `Bearer ${otherShopToken}`)
                .send({ action: 'approve' });

            expect(res.status).toBe(403);
            const updated = await ShopOrder.findById(order._id).lean();
            expect(updated.payment.status).toBe('PENDING_VERIFICATION');
        });

        it('refunds a cancelled order only once, however often it is approved', async () => {
            const order = await createUpiOrder({ status: 'CANCELLED' });

            const first = await request(app)
                .post(`/api/v1/shoporders/${order._id}/verify-payment`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ action: 'approve' });
            const second = await request(app)
                .post(`/api/v1/shoporders/${order._id}/verify-payment`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ action: 'approve' });

            expect(first.status).toBe(200);
            expect(second.status).toBe(409);
            const refreshed = await Customer.findById(customer._id).lean();
            expect(refreshed.wallet.balance).toBe(5200);
        });

        it('refuses the owning shop approving its own order; only an admin can', async () => {
            const order = await createUpiOrder();
            const shopRes = await request(app)
                .post(`/api/v1/shoporders/${order._id}/verify-payment`)
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ action: 'approve' });
            expect(shopRes.status).toBe(403);
            expect((await ShopOrder.findById(order._id).lean()).payment.status).toBe('PENDING_VERIFICATION');

            const res = await request(app)
                .post(`/api/v1/shoporders/${order._id}/verify-payment`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ action: 'approve' });
            expect(res.status).toBe(200);
            const updated = await ShopOrder.findById(order._id).lean();
            expect(updated.payment.status).toBe('PAID');
        });
    });

    describe('Promo codes', () => {
        it('applies a promo code to a shop order instead of crashing', async () => {
            await Promotion.create({ code: 'SAVE20', title: 'Save 20', type: 'FLAT_DISCOUNT', value: 20, isActive: true });

            const res = await request(app)
                .post('/api/v1/shoporders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    shopId: String(shop._id),
                    items: [{ productId: String(product._id), name: 'Milk 1L', price: 200, qty: 1 }],
                    deliveryAddress: '123 Main St',
                    deliveryLocation: { type: 'Point', coordinates: [72.8777, 19.0760] },
                    paymentMethod: 'WALLET',
                    promoCode: 'save20'
                });

            expect(res.status).toBeLessThan(300);
            const promo = await Promotion.findOne({ code: 'SAVE20' }).lean();
            expect(promo.usesCount).toBe(1);
        });

        it('enforces the per-user limit on shop orders', async () => {
            await Promotion.create({ code: 'ONCE', title: 'Once', type: 'FLAT_DISCOUNT', value: 10, isActive: true, maxUsesPerUser: 1 });
            const place = () => request(app)
                .post('/api/v1/shoporders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    shopId: String(shop._id),
                    items: [{ productId: String(product._id), name: 'Milk 1L', price: 200, qty: 1 }],
                    deliveryAddress: '123 Main St',
                    deliveryLocation: { type: 'Point', coordinates: [72.8777, 19.0760] },
                    paymentMethod: 'WALLET',
                    promoCode: 'ONCE'
                });

            const first = await place();
            const second = await place();

            expect(first.status).toBeLessThan(300);
            expect(second.status).toBe(400);
            expect(second.body.message).toMatch(/usage limit/i);
        });

        it('leaves the job retryable when the promo code is over its limit', async () => {
            await Promotion.create({ code: 'FULL', title: 'Full', type: 'FLAT_DISCOUNT', value: 10, isActive: true, maxUsesTotal: 1, usesCount: 1 });
            const job = await createCompletedJob();

            const res = await request(app)
                .post(`/api/v1/jobs/${job._id}/pay`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ method: 'WALLET', completionOtp: '2222', promoCode: 'FULL' });

            expect(res.status).toBe(400);
            const after = await Job.findById(job._id).lean();
            expect(after.status).toBe('COMPLETED');

            const retry = await request(app)
                .post(`/api/v1/jobs/${job._id}/pay`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ method: 'WALLET', completionOtp: '2222' });
            expect(retry.status).toBe(200);
            expect((await Job.findById(job._id).lean()).status).toBe('PAID');
        });
    });

    describe('Cash job at the worker credit limit', () => {
        it('refuses cash instead of silently waiving the platform fee', async () => {
            await Customer.findByIdAndUpdate(worker._id, { 'wallet.balance': -500 });
            const job = await createCompletedJob();

            const res = await request(app)
                .post(`/api/v1/jobs/${job._id}/pay`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ method: 'CASH', completionOtp: '2222' });

            expect(res.status).toBe(402);
            expect((await Job.findById(job._id).lean()).status).toBe('COMPLETED');
            expect((await Customer.findById(worker._id).lean()).wallet.balance).toBe(-500);
        });
    });
});
