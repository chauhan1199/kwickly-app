const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Shop = require('../modules/shop/shop.model');
const Product = require('../modules/product/product.model');
const ShopOrder = require('../modules/shoporder/shoporder.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('ShopOrder Routes — Extended', () => {
    let shopOwner, shopToken, customer, customerToken, adminToken, shopId, productId;

    beforeEach(async () => {
        shopOwner = await createTestUser({ role: 'SHOP', email: 'orderextshop@test.com', phone: '1234567890' });
        shopToken = generateToken(shopOwner);

        customer = await createTestUser({ role: 'CUSTOMER', email: 'orderextc@test.com', phone: '1234567891', wallet: { balance: 10000 } });
        customerToken = generateToken(customer);

        const admin = await createTestUser({ role: 'ADMIN', email: 'orderextadmin@test.com', phone: '1234567892' });
        adminToken = generateToken(admin);

        const shop = await Shop.create({
            ownerId: shopOwner._id,
            name: 'Order Ext Shop',
            address: '123 Main St',
            location: { type: 'Point', coordinates: [72.8777, 19.0760] },
            isOnline: true,
            kyc: { status: 'APPROVED' },
            delivery: { radiusKm: 5, fee: 40, freeAbove: 500 }
        });
        shopId = shop._id;

        const product = await Product.create({
            shopId,
            name: 'Milk 1L',
            price: 68,
            stock: 50
        });
        productId = product._id;
    });

    describe('POST /api/v1/shoporders/:id/cancel', () => {
        it('should cancel a NEW order as the owning customer', async () => {
            const order = await ShopOrder.create({
                shopId,
                customerId: customer._id,
                items: [{ productId, name: 'Milk 1L', price: 68, qty: 2 }],
                subtotal: 136,
                deliveryFee: 40,
                total: 176,
                deliveryAddress: 'A-14, Sector 12, Noida',
                status: 'NEW',
                payment: { amount: 176, status: 'PAID', method: 'WALLET' },
                statusHistory: [{ status: 'NEW', timestamp: new Date(), note: 'Order placed' }]
            });

            const res = await request(app)
                .post(`/api/v1/shoporders/${order._id}/cancel`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.status).toBe('CANCELLED');
        });

        it('should return 404 when cancelling order not owned by customer', async () => {
            const otherCustomer = await createTestUser({ role: 'CUSTOMER', email: 'otherorder@test.com', phone: '9999999999' });
            const otherToken = generateToken(otherCustomer);

            const order = await ShopOrder.create({
                shopId,
                customerId: customer._id,
                items: [{ productId, name: 'Milk 1L', price: 68, qty: 1 }],
                subtotal: 68,
                deliveryFee: 40,
                total: 108,
                deliveryAddress: 'B-20, Sector 5',
                status: 'NEW',
                payment: { amount: 108, status: 'PENDING' },
                statusHistory: [{ status: 'NEW', timestamp: new Date() }]
            });

            const res = await request(app)
                .post(`/api/v1/shoporders/${order._id}/cancel`)
                .set('Authorization', `Bearer ${otherToken}`);

            expect(res.status).toBe(404);
        });

        it('should return 400 when cancelling order not in NEW status', async () => {
            const order = await ShopOrder.create({
                shopId,
                customerId: customer._id,
                items: [{ productId, name: 'Milk 1L', price: 68, qty: 2 }],
                subtotal: 136,
                deliveryFee: 40,
                total: 176,
                deliveryAddress: 'A-14, Sector 12, Noida',
                status: 'CONFIRMED',
                payment: { amount: 176, status: 'PAID' },
                statusHistory: [{ status: 'NEW', timestamp: new Date() }, { status: 'CONFIRMED', timestamp: new Date() }]
            });

            const res = await request(app)
                .post(`/api/v1/shoporders/${order._id}/cancel`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/only new orders/i);
        });

        it('should return 404 for non-existent order', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .post(`/api/v1/shoporders/${fakeId}/cancel`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(404);
        });

        it('should reject shop owner from cancelling orders', async () => {
            const order = await ShopOrder.create({
                shopId,
                customerId: customer._id,
                items: [{ productId, name: 'Milk 1L', price: 68, qty: 1 }],
                subtotal: 68,
                deliveryFee: 40,
                total: 108,
                deliveryAddress: 'A-14, Sector 12, Noida',
                status: 'NEW',
                payment: { amount: 108, status: 'PENDING' },
                statusHistory: [{ status: 'NEW', timestamp: new Date() }]
            });

            const res = await request(app)
                .post(`/api/v1/shoporders/${order._id}/cancel`)
                .set('Authorization', `Bearer ${shopToken}`);

            expect(res.status).toBe(403);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/shoporders/507f1f77bcf86cd799439011/cancel');

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/v1/shoporders/:id/invoice', () => {
        it('should return invoice HTML for order owner', async () => {
            const order = await ShopOrder.create({
                shopId,
                customerId: customer._id,
                items: [{ productId, name: 'Milk 1L', price: 68, qty: 2 }],
                subtotal: 136,
                deliveryFee: 40,
                total: 176,
                deliveryAddress: 'A-14, Sector 12, Noida',
                status: 'DELIVERED',
                payment: { amount: 176, status: 'PAID' },
                statusHistory: [{ status: 'NEW', timestamp: new Date() }]
            });

            const res = await request(app)
                .get(`/api/v1/shoporders/${order._id}/invoice`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\/html/);
            expect(res.text).toContain('Kwickly Invoice');
            expect(res.text).toContain('Milk 1L');
            expect(res.text).toContain('136');
            expect(res.text).toContain('176');
        });

        it('should return invoice for shop owner', async () => {
            const order = await ShopOrder.create({
                shopId,
                customerId: customer._id,
                items: [{ productId, name: 'Milk 1L', price: 68, qty: 1 }],
                subtotal: 68,
                deliveryFee: 40,
                total: 108,
                deliveryAddress: 'B-20, Sector 5',
                status: 'NEW',
                payment: { amount: 108, status: 'PENDING' },
                statusHistory: [{ status: 'NEW', timestamp: new Date() }]
            });

            const res = await request(app)
                .get(`/api/v1/shoporders/${order._id}/invoice`)
                .set('Authorization', `Bearer ${shopToken}`);

            expect(res.status).toBe(200);
            expect(res.text).toContain('Kwickly Invoice');
        });

        it('should return 404 for non-existent order', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .get(`/api/v1/shoporders/${fakeId}/invoice`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(404);
        });

        it('should reject other customer from viewing invoice', async () => {
            const otherCustomer = await createTestUser({ role: 'CUSTOMER', email: 'otherinvoice@test.com', phone: '8888888888' });
            const otherToken = generateToken(otherCustomer);

            const order = await ShopOrder.create({
                shopId,
                customerId: customer._id,
                items: [{ productId, name: 'Milk 1L', price: 68, qty: 1 }],
                subtotal: 68,
                deliveryFee: 40,
                total: 108,
                deliveryAddress: 'A-14, Sector 12, Noida',
                status: 'NEW',
                payment: { amount: 108, status: 'PENDING' },
                statusHistory: [{ status: 'NEW', timestamp: new Date() }]
            });

            const res = await request(app)
                .get(`/api/v1/shoporders/${order._id}/invoice`)
                .set('Authorization', `Bearer ${otherToken}`);

            expect(res.status).toBe(403);
        });

        it('should return invoice to admin for any order', async () => {
            const order = await ShopOrder.create({
                shopId,
                customerId: customer._id,
                items: [{ productId, name: 'Milk 1L', price: 68, qty: 1 }],
                subtotal: 68,
                deliveryFee: 40,
                total: 108,
                deliveryAddress: 'A-14, Sector 12, Noida',
                status: 'NEW',
                payment: { amount: 108, status: 'PENDING' },
                statusHistory: [{ status: 'NEW', timestamp: new Date() }]
            });

            const res = await request(app)
                .get(`/api/v1/shoporders/${order._id}/invoice`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.text).toContain('Kwickly Invoice');
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .get('/api/v1/shoporders/507f1f77bcf86cd799439011/invoice');

            expect(res.status).toBe(401);
        });
    });
});
