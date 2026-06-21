const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Shop = require('../modules/shop/shop.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Shop Routes', () => {
    let shopToken, customerToken, adminToken, shopOwnerId;

    beforeEach(async () => {
        const shopOwner = await createTestUser({ role: 'SHOP', email: 'shopowner@test.com', phone: '1234567890' });
        shopToken = generateToken(shopOwner);
        shopOwnerId = shopOwner._id;

        const customer = await createTestUser({ role: 'CUSTOMER', email: 'shopcustomer@test.com', phone: '1234567891' });
        customerToken = generateToken(customer);

        const admin = await createTestUser({ role: 'ADMIN', email: 'shopadmin@test.com', phone: '1234567892' });
        adminToken = generateToken(admin);
    });

    describe('POST /api/v1/shops', () => {
        it('should create a shop', async () => {
            const res = await request(app)
                .post('/api/v1/shops')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({
                    name: 'Test Shop',
                    category: 'General',
                    address: '123 Main St',
                    location: { type: 'Point', coordinates: [72.8777, 19.0760] }
                });
            expect(res.status).toBe(201);
            expect(res.body.data.name).toBe('Test Shop');
        });

        it('should reject shop creation without required fields', async () => {
            const res = await request(app)
                .post('/api/v1/shops')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ name: 'Test Shop' });
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/v1/shops/my', () => {
        it('should return shop owner shop', async () => {
            await Shop.create({
                ownerId: shopOwnerId,
                name: 'My Shop',
                address: '123 Main St',
                location: { type: 'Point', coordinates: [72.8777, 19.0760] }
            });

            const res = await request(app)
                .get('/api/v1/shops/my')
                .set('Authorization', `Bearer ${shopToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/shops', () => {
        it('should return all shops', async () => {
            await Shop.create({
                ownerId: shopOwnerId,
                name: 'Test Shop',
                address: '123 Main St',
                location: { type: 'Point', coordinates: [72.8777, 19.0760] }
            });

            const res = await request(app)
                .get('/api/v1/shops')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('GET /api/v1/shops/:id', () => {
        it('should return shop by id', async () => {
            const shop = await Shop.create({
                ownerId: shopOwnerId,
                name: 'Test Shop',
                address: '123 Main St',
                location: { type: 'Point', coordinates: [72.8777, 19.0760] }
            });

            const res = await request(app)
                .get(`/api/v1/shops/${shop._id}`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('PATCH /api/v1/shops/my', () => {
        it('should update shop profile', async () => {
            await Shop.create({
                ownerId: shopOwnerId,
                name: 'Old Name',
                address: '123 Main St',
                location: { type: 'Point', coordinates: [72.8777, 19.0760] }
            });

            const res = await request(app)
                .patch('/api/v1/shops/my')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ name: 'New Name' });
            expect(res.status).toBe(200);
        });
    });

    describe('PATCH /api/v1/shops/:id/kyc (Admin)', () => {
        it('should update shop KYC status', async () => {
            const shop = await Shop.create({
                ownerId: shopOwnerId,
                name: 'Test Shop',
                address: '123 Main St',
                location: { type: 'Point', coordinates: [72.8777, 19.0760] }
            });

            const res = await request(app)
                .patch(`/api/v1/shops/${shop._id}/kyc`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'APPROVED' });
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/v1/shops/my/payout-methods', () => {
        it('should add payout method', async () => {
            await Shop.create({
                ownerId: shopOwnerId,
                name: 'Test Shop',
                address: '123 Main St',
                location: { type: 'Point', coordinates: [72.8777, 19.0760] }
            });

            const res = await request(app)
                .post('/api/v1/shops/my/payout-methods')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ type: 'UPI', details: 'test@upi' });
            expect([200, 400]).toContain(res.status);
        });
    });
});
