const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Shop = require('../modules/shop/shop.model');
const Product = require('../modules/product/product.model');
const ShopOrder = require('../modules/shoporder/shoporder.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('ShopOrder Routes', () => {
    let shopToken, customerToken, adminToken, shopId, productId;

    beforeEach(async () => {
        const shopOwner = await createTestUser({ role: 'SHOP', email: 'orderadmin@test.com', phone: '1234567890' });
        shopToken = generateToken(shopOwner);

        const customer = await createTestUser({ role: 'CUSTOMER', email: 'ordercustomer@test.com', phone: '1234567891' });
        customerToken = generateToken(customer);

        const admin = await createTestUser({ role: 'ADMIN', email: 'orderadmin2@test.com', phone: '1234567892' });
        adminToken = generateToken(admin);

        const shop = await Shop.create({
            ownerId: shopOwner._id,
            name: 'Order Shop',
            address: '123 Main St',
            location: { type: 'Point', coordinates: [72.8777, 19.0760] }
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

    describe('POST /api/v1/shoporders', () => {
        it('should place an order as customer (or 403 if no subscription)', async () => {
            const res = await request(app)
                .post('/api/v1/shoporders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    shopId,
                    items: [{ productId, name: 'Milk 1L', price: 68, qty: 2 }],
                    deliveryAddress: 'A-14, Sector 12, Noida',
                    paymentMethod: 'WALLET',
                    deliveryLocation: { type: 'Point', coordinates: [77.3178, 28.5800] }
                });
            expect([200, 403]).toContain(res.status);
        });

        it('should reject order without items', async () => {
            const res = await request(app)
                .post('/api/v1/shoporders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    shopId,
                    items: [],
                    deliveryAddress: 'A-14, Sector 12, Noida',
                    paymentMethod: 'WALLET',
                    deliveryLocation: { type: 'Point', coordinates: [77.3178, 28.5800] }
                });
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/v1/shoporders/customer', () => {
        it('should return customer orders', async () => {
            const res = await request(app)
                .get('/api/v1/shoporders/customer')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/shoporders/shop', () => {
        it('should return shop orders', async () => {
            const res = await request(app)
                .get('/api/v1/shoporders/shop')
                .set('Authorization', `Bearer ${shopToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/shoporders/all (Admin)', () => {
        it('should return all orders for admin', async () => {
            const res = await request(app)
                .get('/api/v1/shoporders/all')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('PATCH /api/v1/shoporders/:id/status', () => {
        it('should update order status', async () => {
            const order = await ShopOrder.create({
                shopId,
                customerId: '507f1f77bcf86cd799439011',
                items: [{ productId, name: 'Milk 1L', price: 68, qty: 2 }],
                subtotal: 136,
                deliveryFee: 40,
                total: 176,
                deliveryAddress: 'A-14, Sector 12, Noida',
                status: 'NEW',
                payment: { amount: 176, status: 'PENDING' }
            });

            const res = await request(app)
                .patch(`/api/v1/shoporders/${order._id}/status`)
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ status: 'PACKING' });
            expect(res.status).toBe(200);
        });
    });
});
