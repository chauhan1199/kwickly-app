const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Payment = require('../modules/payment/payment.model');
const ShopOrder = require('../modules/shoporder/shoporder.model');
const Shop = require('../modules/shop/shop.model');
const Product = require('../modules/product/product.model');
const WalletTxn = require('../modules/wallet/wallet.model');

// Pure Direct UPI (NPCI intent) — no payment gateway, no signature verification.
// A payment is only ever CAPTURED after an admin verifies the 12-digit UTR
// against the platform bank statement.

// Generate a unique, format-valid (exactly 12 digits) UTR per test
let utrSeq = 0;
const genUtr = () => {
    utrSeq++;
    const suffix = String(Date.now()).slice(-6) + String(utrSeq).padStart(3, '0');
    return ('4' + suffix + String(Math.floor(Math.random() * 90) + 10)).slice(0, 12).padEnd(12, '7');
};

beforeAll(async () => {
    await setup();
}, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Payment Integration (Direct UPI)', () => {
    let customerToken, adminToken, customerId;
    let shopId, productId;

    beforeEach(async () => {
        const customer = await createTestUser({
            role: 'CUSTOMER', email: 'paytest@test.com', phone: '9876543210',
            wallet: { balance: 1000 }
        });
        customerToken = generateToken(customer);
        customerId = customer._id;

        const admin = await createTestUser({ role: 'ADMIN', email: 'payadmin@test.com', phone: '9876543211' });
        adminToken = generateToken(admin);

        const shopOwner = await createTestUser({ role: 'SHOP', email: 'payshop@test.com', phone: '9876543212' });
        const shop = await Shop.create({
            ownerId: shopOwner._id,
            name: 'Payment Test Shop',
            address: '123 Test St',
            location: { type: 'Point', coordinates: [72.8777, 19.0760] },
            isOnline: true,
            kyc: { status: 'APPROVED' },
            deliveryConfig: { deliveryRadiusKm: 5, deliveryCharge: 40, freeDeliveryAbove: 500 }
        });
        shopId = shop._id;

        const product = await Product.create({
            shopId, name: 'Test Product', price: 250, stock: 50, isActive: true
        });
        productId = product._id;
    });

    describe('POST /api/v1/payments/create-order', () => {
        it('should create a Direct UPI order with an NPCI intent URI', async () => {
            const res = await request(app)
                .post('/api/v1/payments/create-order')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 500, purpose: 'order_payment' });

            expect(res.status).toBe(201);
            expect(res.body.data.isUpiDirect).toBe(true);
            expect(res.body.data.upiOrderId).toMatch(/^upi_ord_/);
            expect(res.body.data.razorpayOrderId).toBe(res.body.data.upiOrderId); // backward-compat alias
            expect(res.body.data.upiIntentUri).toMatch(/^upi:\/\/pay\?pa=/);
            expect(res.body.data.upiVpa).toBeDefined();
            expect(res.body.data.currency).toBe('INR');

            const payment = await Payment.findOne({ razorpayOrderId: res.body.data.upiOrderId });
            expect(payment).toBeTruthy();
            expect(payment.status).toBe('CREATED');
            expect(payment.method).toBe('UPI');
        });

        it('should reject with zero amount', async () => {
            const res = await request(app)
                .post('/api/v1/payments/create-order')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 0 });

            expect(res.status).toBe(400);
        });

        it('should reject without auth', async () => {
            const res = await request(app)
                .post('/api/v1/payments/create-order')
                .send({ amount: 500 });

            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/v1/payments/verify', () => {
        it('should hold a wallet top-up as PENDING_VERIFICATION (no instant credit)', async () => {
            const createRes = await request(app)
                .post('/api/v1/payments/create-order')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 500, purpose: 'wallet_topup' });
            expect(createRes.status).toBe(201);

            const utr = genUtr();
            const res = await request(app)
                .post('/api/v1/payments/verify')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    razorpayOrderId: createRes.body.data.upiOrderId,
                    utrNumber: utr,
                    purpose: 'wallet_topup',
                    amount: 500
                });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('PENDING_VERIFICATION');
            expect(res.body.data.utr).toBe(utr);

            // Wallet NOT credited yet — admin must verify against the bank statement
            const pendingTxn = await WalletTxn.findOne({ type: 'TOPUP', razorpayPaymentId: utr });
            expect(pendingTxn).toBeTruthy();
            expect(pendingTxn.status).toBe('PENDING');
        });

        it('should reject an invalid UTR (not 12 digits)', async () => {
            const createRes = await request(app)
                .post('/api/v1/payments/create-order')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 500, purpose: 'wallet_topup' });

            const res = await request(app)
                .post('/api/v1/payments/verify')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    razorpayOrderId: createRes.body.data.upiOrderId,
                    utrNumber: '12345', // too short
                    purpose: 'wallet_topup'
                });

            expect(res.status).toBe(400);
        });

        it('should reject a fake/dummy UTR pattern', async () => {
            const createRes = await request(app)
                .post('/api/v1/payments/create-order')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 500, purpose: 'wallet_topup' });

            const res = await request(app)
                .post('/api/v1/payments/verify')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    razorpayOrderId: createRes.body.data.upiOrderId,
                    utrNumber: '123456789012', // known dummy pattern
                    purpose: 'wallet_topup'
                });

            expect(res.status).toBe(400);
        });

        it('should reject with missing order reference', async () => {
            const res = await request(app)
                .post('/api/v1/payments/verify')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ utrNumber: genUtr() });

            expect(res.status).toBe(400);
        });

        it('should not duplicate a pending top-up when the same UTR is re-submitted', async () => {
            const createRes = await request(app)
                .post('/api/v1/payments/create-order')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 500, purpose: 'wallet_topup' });

            const utr = genUtr();
            const body = {
                razorpayOrderId: createRes.body.data.upiOrderId,
                utrNumber: utr,
                purpose: 'wallet_topup',
                amount: 500
            };
            await request(app).post('/api/v1/payments/verify')
                .set('Authorization', `Bearer ${customerToken}`).send(body);
            const res2 = await request(app).post('/api/v1/payments/verify')
                .set('Authorization', `Bearer ${customerToken}`).send(body);

            expect(res2.status).toBe(200);
            const txns = await WalletTxn.find({ type: 'TOPUP', razorpayPaymentId: utr });
            expect(txns.length).toBe(1); // still exactly one — no double credit
        });

        it('should reject a UTR already used on another captured payment', async () => {
            const utr = genUtr();
            // Simulate an already-verified (CAPTURED) payment from another order
            await Payment.create({
                razorpayOrderId: 'upi_ord_other',
                razorpayPaymentId: utr,
                amount: 500,
                userId: customerId,
                status: 'CAPTURED',
                method: 'UPI'
            });

            const createRes = await request(app)
                .post('/api/v1/payments/create-order')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 500, purpose: 'wallet_topup' });

            const res = await request(app)
                .post('/api/v1/payments/verify')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    razorpayOrderId: createRes.body.data.upiOrderId,
                    utrNumber: utr,
                    purpose: 'wallet_topup'
                });

            expect(res.status).toBe(409);
        });

        it('should mark an order PENDING_VERIFICATION when paying for an order via UPI', async () => {
            const utr = genUtr();
            const order = await ShopOrder.create({
                shopId, customerId,
                items: [{ name: 'Test', price: 250, qty: 2 }],
                subtotal: 500,
                total: 500,
                status: 'CONFIRMED',
                payment: { amount: 500, status: 'PENDING', method: 'UPI' },
                statusHistory: [{ status: 'CONFIRMED' }]
            });

            const res = await request(app)
                .post('/api/v1/payments/verify')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    razorpayOrderId: `upi_ord_${Date.now()}`,
                    orderId: String(order._id),
                    utrNumber: utr
                });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('PENDING_VERIFICATION');
            expect(String(res.body.data.orderId)).toBe(String(order._id));

            const updated = await ShopOrder.findById(order._id);
            expect(updated.payment.status).toBe('PENDING_VERIFICATION');
            expect(updated.payment.utrNumber).toBe(utr);
        });
    });

    describe('POST /api/v1/payments/webhook', () => {
        it('should return 200 (no-op) in Direct UPI mode', async () => {
            const res = await request(app)
                .post('/api/v1/payments/webhook')
                .send({ event: 'anything', payload: {} });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
        });
    });

    describe('POST /api/v1/payments/refund (Admin)', () => {
        it('should refund a captured payment to the customer wallet', async () => {
            const order = await ShopOrder.create({
                shopId,
                customerId,
                items: [{ name: 'Test', price: 250, qty: 2 }],
                subtotal: 500,
                total: 540,
                status: 'DELIVERED',
                payment: { amount: 540, status: 'PAID', method: 'UPI', razorpayPaymentId: 'pay_refundable' },
                statusHistory: [{ status: 'DELIVERED' }]
            });

            await Payment.create({
                orderId: order._id,
                razorpayOrderId: 'upi_ord_refundable',
                razorpayPaymentId: 'pay_refundable',
                amount: 540,
                userId: customerId,
                status: 'CAPTURED',
                method: 'UPI'
            });

            const res = await request(app)
                .post('/api/v1/payments/refund')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ orderId: order._id, amount: 540, reason: 'Customer request' });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('REFUNDED');
            expect(res.body.data.amount).toBe(540);

            const Customer = require('../modules/customer/customer.model');
            const updatedCustomer = await Customer.findById(customerId);
            expect(updatedCustomer.wallet.balance).toBe(1000 + 540);

            const refundTxn = await WalletTxn.findOne({ userId: customerId, type: 'REFUND', amount: 540 });
            expect(refundTxn).toBeTruthy();
        });

        it('should reject refund for non-existing order payment', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .post('/api/v1/payments/refund')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ orderId: fakeId, amount: 100 });

            expect(res.status).toBe(404);
        });

        it('should reject refund by non-admin', async () => {
            const res = await request(app)
                .post('/api/v1/payments/refund')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ orderId: '507f1f77bcf86cd799439011', amount: 100 });

            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/v1/payments/history', () => {
        it('should return user payment history', async () => {
            await Payment.create({
                razorpayOrderId: 'upi_ord_hist_1',
                amount: 500,
                userId: customerId,
                status: 'CAPTURED',
                method: 'UPI'
            });

            const res = await request(app)
                .get('/api/v1/payments/history')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBe(1);
        });
    });

    describe('GET /api/v1/payments/:orderId', () => {
        it('should return payment for order', async () => {
            const order = await ShopOrder.create({
                shopId, customerId,
                items: [{ name: 'Test', price: 250, qty: 1 }],
                subtotal: 250, total: 290,
                payment: { amount: 290, status: 'PAID', method: 'UPI' },
                statusHistory: [{ status: 'NEW' }]
            });

            const payment = await Payment.create({
                orderId: order._id,
                razorpayOrderId: 'upi_ord_detail_test',
                amount: 290,
                userId: customerId,
                status: 'CAPTURED',
                method: 'UPI'
            });

            const res = await request(app)
                .get(`/api/v1/payments/${payment._id}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.razorpayOrderId).toBe('upi_ord_detail_test');

            // Also resolvable by order reference
            const byOrderRes = await request(app)
                .get(`/api/v1/payments/${order._id}`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(byOrderRes.status).toBe(200);
            expect(byOrderRes.body.data.razorpayOrderId).toBe('upi_ord_detail_test');
        });

        it('should return 404 for non-existing payment', async () => {
            const res = await request(app)
                .get('/api/v1/payments/507f1f77bcf86cd799439011')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(404);
        });
    });
});

describe('Order with UPI / Wallet Payment (E2E)', () => {
    let customerToken, customerId, shopId, productId;

    beforeEach(async () => {
        const customer = await createTestUser({
            role: 'CUSTOMER', email: 'e2e@test.com', phone: '9876543210',
            wallet: { balance: 0 },
            addresses: [{
                label: 'Home',
                street: '123 Test St',
                city: 'Mumbai',
                location: { type: 'Point', coordinates: [72.8777, 19.0760] }
            }]
        });
        customerToken = generateToken(customer);
        customerId = customer._id;

        const shopOwner = await createTestUser({ role: 'SHOP', email: 'e2eshop@test.com', phone: '9876543211' });
        const shop = await Shop.create({
            ownerId: shopOwner._id, name: 'E2E Shop', address: '123 Main St',
            location: { type: 'Point', coordinates: [72.8777, 19.0760] },
            isOnline: true, kyc: { status: 'APPROVED' },
            deliveryConfig: { deliveryRadiusKm: 5, deliveryCharge: 40, freeDeliveryAbove: 500 }
        });
        shopId = shop._id;

        const product = await Product.create({
            shopId, name: 'E2E Product', price: 250, stock: 50, isActive: true
        });
        productId = product._id;
    });

    it('should submit a UPI top-up for admin verification (not instant credit)', async () => {
        // Step 1: Create Direct UPI order
        const createRes = await request(app)
            .post('/api/v1/payments/create-order')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ amount: 500, purpose: 'wallet_topup' });

        expect(createRes.status).toBe(201);
        const { upiOrderId } = createRes.body.data;
        expect(createRes.body.data.upiIntentUri).toMatch(/^upi:\/\/pay\?pa=/);

        // Step 2: Customer pays in their UPI app and submits the UTR
        const utr = genUtr();
        const verifyRes = await request(app)
            .post('/api/v1/payments/verify')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                razorpayOrderId: upiOrderId,
                utrNumber: utr,
                purpose: 'wallet_topup',
                amount: 500
            });

        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.data.status).toBe('PENDING_VERIFICATION');

        // Step 3: Wallet still empty until admin approves
        const Customer = require('../modules/customer/customer.model');
        const cust = await Customer.findById(customerId);
        expect(cust.wallet.balance).toBe(0);

        // Step 4: Payment history shows the submitted payment
        const histRes = await request(app)
            .get('/api/v1/payments/history')
            .set('Authorization', `Bearer ${customerToken}`);

        expect(histRes.status).toBe(200);
        expect(histRes.body.data.length).toBeGreaterThan(0);
    });

    it('should handle wallet payment flow', async () => {
        // Update customer wallet to have sufficient balance
        const Customer = require('../modules/customer/customer.model');
        await Customer.findByIdAndUpdate(customerId, { 'wallet.balance': 1000 });

        const orderRes = await request(app)
            .post('/api/v1/shoporders')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                shopId,
                items: [{ productId, name: 'E2E Product', price: 250, qty: 1 }],
                deliveryAddress: 'Home: 123 Test St, Mumbai',
                paymentMethod: 'WALLET',
                deliveryLocation: { type: 'Point', coordinates: [72.8777, 19.0760] }
            });

        expect(orderRes.status).toBe(201);
        expect(orderRes.body.data.payment.status).toBe('PAID');
        expect(orderRes.body.data.payment.method).toBe('WALLET');
        expect(orderRes.body.data.orderNumber).toBeDefined();
    });
});

describe('Payment Model Tests', () => {
    it('should create a payment record', async () => {
        const payment = await Payment.create({
            razorpayOrderId: 'upi_ord_model_test',
            amount: 500,
            userId: '507f1f77bcf86cd799439011',
            status: 'CREATED',
            method: 'UPI'
        });

        expect(payment.razorpayOrderId).toBe('upi_ord_model_test');
        expect(payment.amount).toBe(500);
        expect(payment.status).toBe('CREATED');
        expect(payment.currency).toBe('INR');
    });

    it('should update payment status', async () => {
        const payment = await Payment.create({
            razorpayOrderId: 'upi_ord_update_test',
            amount: 500,
            userId: '507f1f77bcf86cd799439011',
            status: 'CREATED',
            method: 'UPI'
        });

        payment.status = 'CAPTURED';
        payment.razorpayPaymentId = '423456789012';
        await payment.save();

        const updated = await Payment.findById(payment._id);
        expect(updated.status).toBe('CAPTURED');
        expect(updated.razorpayPaymentId).toBe('423456789012');
    });

    it('should enforce unique razorpayOrderId', async () => {
        await Payment.create({
            razorpayOrderId: 'upi_ord_unique_test',
            amount: 500,
            userId: '507f1f77bcf86cd799439011'
        });

        await expect(
            Payment.create({
                razorpayOrderId: 'upi_ord_unique_test',
                amount: 300,
                userId: '507f1f77bcf86cd799439011'
            })
        ).rejects.toThrow();
    });
});
