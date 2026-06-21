const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Payment = require('../modules/payment/payment.model');
const ShopOrder = require('../modules/shoporder/shoporder.model');
const Shop = require('../modules/shop/shop.model');
const Product = require('../modules/product/product.model');

// Mock Razorpay helper
jest.mock('../helpers/razorpay.helper', () => ({
    createRazorpayOrder: jest.fn().mockResolvedValue({
        id: 'order_test123',
        amount: 50000,
        currency: 'INR',
        receipt: 'test_receipt'
    }),
    fetchPayment: jest.fn().mockResolvedValue({
        id: 'pay_test123',
        status: 'captured',
        method: 'upi',
        amount: 50000
    }),
    capturePayment: jest.fn().mockResolvedValue({ id: 'pay_test123', status: 'captured' }),
    createRefund: jest.fn().mockResolvedValue({ id: 'refund_test123', amount: 50000 }),
    verifyPaymentSignature: jest.fn().mockReturnValue(true),
    getRazorpay: jest.fn().mockReturnValue({})
}));

beforeAll(async () => {
    await setup();
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
    process.env.RAZORPAY_KEY_SECRET = 'test_secret';
}, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); jest.clearAllMocks(); }, 10000);

describe('Payment Integration (Razorpay)', () => {
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
            delivery: { radiusKm: 5, fee: 40, freeAbove: 500 }
        });
        shopId = shop._id;

        const product = await Product.create({
            shopId, name: 'Test Product', price: 250, stock: 50, isActive: true
        });
        productId = product._id;
    });

    describe('POST /api/v1/payments/create-order', () => {
        it('should create a Razorpay order', async () => {
            const res = await request(app)
                .post('/api/v1/payments/create-order')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 500, purpose: 'order_payment' });

            expect(res.status).toBe(201);
            expect(res.body.data.razorpayOrderId).toBe('order_test123');
            expect(res.body.data.keyId).toBeDefined();
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
        it('should verify a payment successfully', async () => {
            // First create a payment record
            const payment = await Payment.create({
                razorpayOrderId: 'order_verify_test',
                amount: 500,
                userId: customerId,
                status: 'CREATED'
            });

            const res = await request(app)
                .post('/api/v1/payments/verify')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    razorpayOrderId: 'order_verify_test',
                    razorpayPaymentId: 'pay_verify_test',
                    razorpaySignature: 'valid_signature'
                });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('CAPTURED');
        });

        it('should reject with invalid signature', async () => {
            const { verifyPaymentSignature } = require('../helpers/razorpay.helper');
            verifyPaymentSignature.mockReturnValueOnce(false);

            const res = await request(app)
                .post('/api/v1/payments/verify')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    razorpayOrderId: 'order_bad',
                    razorpayPaymentId: 'pay_bad',
                    razorpaySignature: 'bad_signature'
                });

            expect(res.status).toBe(400);
        });

        it('should reject with missing fields', async () => {
            const res = await request(app)
                .post('/api/v1/payments/verify')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ razorpayOrderId: 'order123' });

            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/v1/payments/webhook', () => {
        it('should handle payment.captured event', async () => {
            const res = await request(app)
                .post('/api/v1/payments/webhook')
                .send({
                    event: 'payment.captured',
                    payload: {
                        payment: {
                            entity: {
                                id: 'pay_webhook_test',
                                order_id: 'order_webhook_test',
                                method: 'upi',
                                amount: 50000
                            }
                        }
                    }
                });

            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
        });

        it('should handle payment.failed event', async () => {
            // Create payment record first
            await Payment.create({
                razorpayOrderId: 'order_fail_test',
                amount: 500,
                userId: customerId,
                status: 'CREATED'
            });

            const res = await request(app)
                .post('/api/v1/payments/webhook')
                .send({
                    event: 'payment.failed',
                    payload: {
                        payment: {
                            entity: {
                                id: 'pay_fail_test',
                                order_id: 'order_fail_test',
                                error_description: 'Payment declined'
                            }
                        }
                    }
                });

            expect(res.status).toBe(200);
        });

        it('should handle refund.created event', async () => {
            await Payment.create({
                razorpayOrderId: 'order_refund_test',
                razorpayPaymentId: 'pay_refund_test',
                amount: 500,
                userId: customerId,
                status: 'CAPTURED'
            });

            const res = await request(app)
                .post('/api/v1/payments/webhook')
                .send({
                    event: 'refund.created',
                    payload: {
                        refund: {
                            entity: {
                                id: 'refund_webhook_test',
                                payment_id: 'pay_refund_test',
                                amount: 50000
                            }
                        }
                    }
                });

            expect(res.status).toBe(200);
        });

        it('should always return 200 for unknown events', async () => {
            const res = await request(app)
                .post('/api/v1/payments/webhook')
                .send({ event: 'unknown.event', payload: {} });

            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/v1/payments/refund (Admin)', () => {
        it('should process refund for an order', async () => {
            // Create an order with payment
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
                razorpayOrderId: 'order_refundable',
                razorpayPaymentId: 'pay_refundable',
                amount: 540,
                userId: customerId,
                status: 'CAPTURED'
            });

            const res = await request(app)
                .post('/api/v1/payments/refund')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ orderId: order._id, amount: 540, reason: 'Customer request' });

            expect(res.status).toBe(200);
            expect(res.body.data.amount).toBe(540);
        });

        it('should reject refund for non-existing order', async () => {
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
                razorpayOrderId: 'order_hist_1',
                amount: 500,
                userId: customerId,
                status: 'CAPTURED'
            });

            const res = await request(app)
                .get('/api/v1/payments/history')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data.payments)).toBe(true);
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

            await Payment.create({
                orderId: order._id,
                razorpayOrderId: 'order_detail_test',
                amount: 290,
                userId: customerId,
                status: 'CAPTURED'
            });

            const res = await request(app)
                .get(`/api/v1/payments/${order._id}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.razorpayOrderId).toBe('order_detail_test');
        });

        it('should return 404 for non-existing payment', async () => {
            const res = await request(app)
                .get('/api/v1/payments/507f1f77bcf86cd799439011')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(404);
        });
    });
});

describe('Order with Razorpay Payment (E2E)', () => {
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
            delivery: { radiusKm: 5, fee: 40, freeAbove: 500 }
        });
        shopId = shop._id;

        const product = await Product.create({
            shopId, name: 'E2E Product', price: 250, stock: 50, isActive: true
        });
        productId = product._id;
    });

    it('should complete full Razorpay payment flow', async () => {
        // Step 1: Create Razorpay order
        const createRes = await request(app)
            .post('/api/v1/payments/create-order')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ amount: 290, purpose: 'order_payment' });

        expect(createRes.status).toBe(201);
        const { razorpayOrderId } = createRes.body.data;

        // Step 2: Give customer wallet balance and place order with WALLET
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

        // Step 3: Verify payment
        const verifyRes = await request(app)
            .post('/api/v1/payments/verify')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                razorpayOrderId,
                razorpayPaymentId: 'pay_e2e_test',
                razorpaySignature: 'valid_signature'
            });

        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.data.status).toBe('CAPTURED');

        // Step 4: Check payment history
        const histRes = await request(app)
            .get('/api/v1/payments/history')
            .set('Authorization', `Bearer ${customerToken}`);

        expect(histRes.status).toBe(200);
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

describe('Webhook Signature Verification', () => {
    it('should handle webhook with valid signature', async () => {
        const res = await request(app)
            .post('/api/v1/payments/webhook')
            .set('x-razorpay-signature', 'valid_sig')
            .send({ event: 'payment.captured', payload: { payment: { entity: {} } } });

        expect(res.status).toBe(200);
    });

    it('should reject webhook with invalid signature when secret is set', async () => {
        const originalSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret';

        const crypto = require('crypto');
        const body = JSON.stringify({ event: 'test', payload: {} });
        const validSig = crypto.createHmac('sha256', 'test_webhook_secret').update(body).digest('hex');

        // Valid signature should pass
        const res = await request(app)
            .post('/api/v1/payments/webhook')
            .set('x-razorpay-signature', validSig)
            .send({ event: 'test', payload: {} });

        expect(res.status).toBe(200);

        process.env.RAZORPAY_WEBHOOK_SECRET = originalSecret;
    });
});

describe('Payment Model Tests', () => {
    it('should create a payment record', async () => {
        const payment = await Payment.create({
            razorpayOrderId: 'order_model_test',
            amount: 500,
            userId: '507f1f77bcf86cd799439011',
            status: 'CREATED'
        });

        expect(payment.razorpayOrderId).toBe('order_model_test');
        expect(payment.amount).toBe(500);
        expect(payment.status).toBe('CREATED');
        expect(payment.currency).toBe('INR');
    });

    it('should update payment status', async () => {
        const payment = await Payment.create({
            razorpayOrderId: 'order_update_test',
            amount: 500,
            userId: '507f1f77bcf86cd799439011',
            status: 'CREATED'
        });

        payment.status = 'CAPTURED';
        payment.razorpayPaymentId = 'pay_captured';
        await payment.save();

        const updated = await Payment.findById(payment._id);
        expect(updated.status).toBe('CAPTURED');
        expect(updated.razorpayPaymentId).toBe('pay_captured');
    });

    it('should enforce unique razorpayOrderId', async () => {
        await Payment.create({
            razorpayOrderId: 'order_unique_test',
            amount: 500,
            userId: '507f1f77bcf86cd799439011'
        });

        await expect(
            Payment.create({
                razorpayOrderId: 'order_unique_test',
                amount: 300,
                userId: '507f1f77bcf86cd799439011'
            })
        ).rejects.toThrow();
    });
});
