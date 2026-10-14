// Regression tests for the 2026-10 shop-order audit: unverified UPI orders,
// shop self-approval, cash/COD settlement, customer cancel, delivered-order
// cancel, refund status and busy riders.

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
const { emitToRoom } = require('../helpers/socket.helper');
const Customer = require('../modules/customer/customer.model');
const Shop = require('../modules/shop/shop.model');
const Product = require('../modules/product/product.model');
const ShopOrder = require('../modules/shoporder/shoporder.model');
const DeliveryStaff = require('../modules/deliveryStaff/deliveryStaff.model');
const PlatformLedger = require('../modules/ledger/platformLedger.model');
const { AdminWallet } = require('../modules/adminWallet/adminWallet.model');
const { Promotion, UserPromoUsage } = require('../modules/promotion/promotion.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); jest.clearAllMocks(); }, 10000);

describe('Shop order audit fixes', () => {
    let customer, customerToken, shopOwner, shopToken, adminToken, shop, product;

    const makeOrder = (overrides = {}) => ShopOrder.create({
        orderNumber: `ORD-T-${Math.random().toString(36).slice(2, 8)}`,
        customerId: customer._id,
        shopId: shop._id,
        items: [{ productId: product._id, name: 'Milk 1L', price: 200, qty: 1 }],
        subtotal: 200,
        netProductSales: 200,
        deliveryFee: 20,
        platformFee: 10,
        gstAmount: 1.8,
        total: 231.8,
        deliveryAddress: '123 Main St',
        deliveryOtp: '4321',
        deliveryOtpGeneratedAt: new Date(),
        payment: { method: 'WALLET', status: 'PAID', amount: 231.8 },
        status: 'NEW',
        statusHistory: [{ status: 'NEW', timestamp: new Date() }],
        ...overrides
    });

    const patchStatus = (id, body, token = shopToken) => request(app)
        .patch(`/api/v1/shoporders/${id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send(body);

    beforeEach(async () => {
        customer = await createTestUser({ role: 'CUSTOMER', email: 'sof-c@test.com', phone: '9833000001', wallet: { balance: 5000 } });
        customerToken = generateToken(customer);
        shopOwner = await createTestUser({ role: 'SHOP', email: 'sof-s@test.com', phone: '9833000002' });
        shopToken = generateToken(shopOwner);
        const admin = await createTestUser({ role: 'ADMIN', email: 'sof-a@test.com', phone: '9833000003' });
        adminToken = generateToken(admin);
        shop = await Shop.create({
            ownerId: shopOwner._id,
            name: 'Audit Shop',
            address: '123 Main St',
            location: { type: 'Point', coordinates: [72.8777, 19.0760] },
            isOnline: true,
            kyc: { status: 'APPROVED' },
            wallet: { balance: 0 }
        });
        product = await Product.create({ shopId: shop._id, name: 'Milk 1L', price: 200, stock: 50, isActive: true });
    });

    describe('#1 unverified UPI orders', () => {
        it('confirms a PENDING_VERIFICATION order when the bank SMS for its UTR arrives later, and only for the right amount', async () => {
            const { handleWalletTopupWebhook } = require('../helpers/webhookHandlers.helper');
            const BankCredit = require('../modules/payment/bankCredit.model');
            const good = await makeOrder({ payment: { method: 'UPI', status: 'PENDING_VERIFICATION', amount: 231.8, utrNumber: '734251986099' } });
            const wrongAmt = await makeOrder({ payment: { method: 'UPI', status: 'PENDING_VERIFICATION', amount: 231.8, utrNumber: '734251986098' } });

            await BankCredit.create({ utr: '734251986099', amount: 231.8, isClaimed: false, receivedAt: new Date() });
            await handleWalletTopupWebhook({ utr: '734251986099', amount: 231.8 }, '734251986099');
            expect((await ShopOrder.findById(good._id).lean()).payment.status).toBe('PAID');
            expect((await BankCredit.findOne({ utr: '734251986099' }).lean()).isClaimed).toBe(true);

            await BankCredit.create({ utr: '734251986098', amount: 100, isClaimed: false, receivedAt: new Date() });
            await handleWalletTopupWebhook({ utr: '734251986098', amount: 100 }, '734251986098');
            expect((await ShopOrder.findById(wrongAmt._id).lean()).payment.status).toBe('PENDING_VERIFICATION');
        });

        it('blocks the shop from confirming a PENDING_VERIFICATION UPI order', async () => {
            const order = await makeOrder({ payment: { method: 'UPI', status: 'PENDING_VERIFICATION', amount: 231.8, utrNumber: '734251986012' } });
            const res = await patchStatus(order._id, { status: 'CONFIRMED' });
            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/Waiting for payment confirmation/);
            expect((await ShopOrder.findById(order._id).lean()).status).toBe('NEW');
        });

        it('does not deliver or settle an unverified UPI order, and never marks it PAID', async () => {
            const order = await makeOrder({ status: 'OUT_FOR_DELIVERY', payment: { method: 'UPI', status: 'PENDING_VERIFICATION', amount: 231.8 } });
            const res = await patchStatus(order._id, { status: 'DELIVERED', otp: '4321' });
            expect(res.status).toBe(400);
            const updated = await ShopOrder.findById(order._id).lean();
            expect(updated.status).toBe('OUT_FOR_DELIVERY');
            expect(updated.payment.status).toBe('PENDING_VERIFICATION');
            expect((await Shop.findById(shop._id).lean()).wallet.balance).toBe(0);
            expect(await PlatformLedger.countDocuments({ entityId: order._id })).toBe(0);
        });

        it('lets the shop confirm once the UPI payment is PAID', async () => {
            const order = await makeOrder({ payment: { method: 'UPI', status: 'PAID', amount: 231.8 } });
            const res = await patchStatus(order._id, { status: 'CONFIRMED' });
            expect(res.status).toBe(200);
        });
    });

    describe('#2 verify-payment is admin only', () => {
        it('rejects the shop approving its own UPI payment', async () => {
            const order = await makeOrder({ payment: { method: 'UPI', status: 'PENDING_VERIFICATION', amount: 231.8 } });
            const res = await request(app)
                .post(`/api/v1/shoporders/${order._id}/verify-payment`)
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ action: 'approve' });
            expect(res.status).toBe(403);
            expect((await ShopOrder.findById(order._id).lean()).payment.status).toBe('PENDING_VERIFICATION');
        });

        it('lets an admin approve it without booking the order total into the treasury', async () => {
            const order = await makeOrder({ payment: { method: 'UPI', status: 'PENDING_VERIFICATION', amount: 231.8 } });
            const res = await request(app)
                .post(`/api/v1/shoporders/${order._id}/verify-payment`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ action: 'approve' });
            expect(res.status).toBe(200);
            expect((await ShopOrder.findById(order._id).lean()).payment.status).toBe('PAID');
            const aw = await AdminWallet.findOne().lean();
            expect(aw?.balance || 0).toBe(0);
        });
    });

    describe('#3 cash / COD orders', () => {
        it.each(['CASH', 'COD'])('%s: shop wallet is debited fee + GST, treasury books fee + GST liability, payment PAID', async (method) => {
            const order = await makeOrder({ status: 'OUT_FOR_DELIVERY', payment: { method, status: 'PENDING', amount: 231.8 } });
            const res = await patchStatus(order._id, { status: 'DELIVERED', otp: '4321' });
            expect(res.status).toBe(200);

            const updated = await ShopOrder.findById(order._id).lean();
            expect(updated.status).toBe('DELIVERED');
            expect(updated.payment.status).toBe('PAID');
            expect((await Shop.findById(shop._id).lean()).wallet.balance).toBeCloseTo(-11.8);

            const aw = await AdminWallet.findOne().lean();
            expect(aw.platformFeeRevenue).toBeCloseTo(10);
            expect(aw.gstLiability).toBeCloseTo(1.8);
            const ledger = await PlatformLedger.findOne({ idempotencyKey: `settle_order_${order._id}` }).lean();
            expect(ledger.paymentMethod).toBe('CASH');
        });

        it('wallet orders still credit the shop product + delivery', async () => {
            const order = await makeOrder({ status: 'OUT_FOR_DELIVERY' });
            const res = await patchStatus(order._id, { status: 'DELIVERED', otp: '4321' });
            expect(res.status).toBe(200);
            expect((await Shop.findById(shop._id).lean()).wallet.balance).toBe(220);
        });

        it('accepts CASH as a payment method at checkout', async () => {
            const res = await request(app)
                .post('/api/v1/shoporders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    shopId: String(shop._id),
                    items: [{ productId: String(product._id), name: 'Milk 1L', price: 200, qty: 1 }],
                    deliveryAddress: '123 Main St',
                    deliveryLocation: { type: 'Point', coordinates: [72.8777, 19.0760] },
                    paymentMethod: 'CASH'
                });
            expect(res.status).toBe(201);
            expect(res.body.data.payment.method).toBe('CASH');
        });
    });

    describe('delivery radius', () => {
        const place = (extra) => request(app)
            .post('/api/v1/shoporders')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                shopId: String(shop._id),
                items: [{ productId: String(product._id), name: 'Milk 1L', price: 200, qty: 1 }],
                deliveryAddress: 'Far away',
                paymentMethod: 'WALLET',
                ...extra
            });

        it('rejects an address outside the shop delivery radius', async () => {
            // Ahmedabad vs a Mumbai shop (default radius 3 km)
            const res = await place({ deliveryLocation: { type: 'Point', coordinates: [72.5714, 23.0225] } });
            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/outside the shop's delivery area \(3 km\)/);
            expect(await ShopOrder.countDocuments()).toBe(0);
            expect((await Product.findById(product._id).lean()).stock).toBe(50);
        });

        it('requires a delivery location', async () => {
            const res = await place({});
            expect(res.status).toBe(400);
            expect(await ShopOrder.countDocuments()).toBe(0);
        });

        it('accepts an address inside the radius', async () => {
            const res = await place({ deliveryLocation: { type: 'Point', coordinates: [72.8800, 19.0800] } });
            expect(res.status).toBe(201);
        });
    });

    describe('#4 customer cancel of an unpaid order', () => {
        it('cancels without a 500, keeps a valid payment status and tells the shop', async () => {
            const order = await makeOrder({ payment: { method: 'COD', status: 'PENDING', amount: 231.8 } });
            const res = await request(app)
                .post(`/api/v1/shoporders/${order._id}/cancel`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
            const updated = await ShopOrder.findById(order._id).lean();
            expect(updated.status).toBe('CANCELLED');
            expect(['PENDING', 'FAILED']).toContain(updated.payment.status);
            expect(emitToRoom).toHaveBeenCalledWith(`shop_${shop._id}`, 'ORDER_STATUS', expect.objectContaining({ status: 'CANCELLED' }));
        });

        it('gives back the promo use (#18)', async () => {
            const promo = await Promotion.create({ code: 'SAVE20', title: 'Save 20', type: 'FLAT_DISCOUNT', value: 20, isActive: true, usesCount: 1 });
            await UserPromoUsage.create({ promoId: promo._id, userId: customer._id });
            const order = await makeOrder({ promoCode: 'SAVE20' });
            await request(app).post(`/api/v1/shoporders/${order._id}/cancel`).set('Authorization', `Bearer ${customerToken}`);
            expect((await Promotion.findById(promo._id).lean()).usesCount).toBe(0);
            expect(await UserPromoUsage.countDocuments({ promoId: promo._id })).toBe(0);
        });
    });

    describe('#5 cancelling a delivered order', () => {
        it('forbids the shop', async () => {
            const order = await makeOrder({ status: 'DELIVERED' });
            const res = await patchStatus(order._id, { status: 'CANCELLED' });
            expect(res.status).toBe(403);
            expect((await ShopOrder.findById(order._id).lean()).status).toBe('DELIVERED');
        });

        it('allows an admin', async () => {
            const order = await makeOrder({ status: 'DELIVERED' });
            const res = await patchStatus(order._id, { status: 'CANCELLED' }, adminToken);
            expect(res.status).toBe(200);
            expect((await ShopOrder.findById(order._id).lean()).status).toBe('CANCELLED');
        });
    });

    describe('#13 shop cancel of a paid order', () => {
        it('refunds the customer and marks the payment REFUNDED', async () => {
            const order = await makeOrder({ status: 'CONFIRMED' });
            const res = await patchStatus(order._id, { status: 'CANCELLED' });
            expect(res.status).toBe(200);
            const updated = await ShopOrder.findById(order._id).lean();
            expect(updated.payment.status).toBe('REFUNDED');
            expect((await Customer.findById(customer._id).lean()).wallet.balance).toBeCloseTo(5231.8);
        });
    });

    describe('#17 dispatching a busy rider', () => {
        it('rejects a rider already on an active delivery', async () => {
            const busyOrder = await makeOrder({ status: 'OUT_FOR_DELIVERY' });
            const staff = await DeliveryStaff.create({ shopId: shop._id, name: 'Ravi', phone: '9833000009', activeOrderId: busyOrder._id });
            const order = await makeOrder({ status: 'PACKING' });
            const res = await patchStatus(order._id, { status: 'OUT_FOR_DELIVERY', deliveryStaffId: String(staff._id) });
            expect(res.status).toBe(409);
            expect(res.body.message).toMatch(/already delivering/);
            expect((await ShopOrder.findById(order._id).lean()).status).toBe('PACKING');
        });

        it('allows a rider whose previous order is finished', async () => {
            const doneOrder = await makeOrder({ status: 'DELIVERED' });
            const staff = await DeliveryStaff.create({ shopId: shop._id, name: 'Ravi', phone: '9833000009', activeOrderId: doneOrder._id });
            const order = await makeOrder({ status: 'PACKING' });
            const res = await patchStatus(order._id, { status: 'OUT_FOR_DELIVERY', deliveryStaffId: String(staff._id) });
            expect(res.status).toBe(200);
        });
    });
});
