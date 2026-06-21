const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Validation Tests', () => {
    describe('Auth Validation', () => {
        it('should reject login without password', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'test@test.com' });
            expect(res.status).toBe(400);
        });

        it('should reject send-otp without phone', async () => {
            const res = await request(app)
                .post('/api/v1/auth/send-otp')
                .send({ role: 'CUSTOMER' });
            expect(res.status).toBe(400);
        });

        it('should reject verify-otp with wrong code length', async () => {
            const res = await request(app)
                .post('/api/v1/auth/verify-otp')
                .send({ phone: '9876543210', code: '12', role: 'CUSTOMER' });
            expect(res.status).toBe(400);
        });

        it('should reject forgot-password with short phone', async () => {
            const res = await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({ phone: '123', role: 'CUSTOMER' });
            expect(res.status).toBe(400);
        });
    });

    describe('Job Validation', () => {
        let customerToken;

        beforeEach(async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'valcustomer@test.com', phone: '1234567890' });
            customerToken = generateToken(customer);
        });

        it('should reject job without category', async () => {
            const res = await request(app)
                .post('/api/v1/jobs')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ description: 'Fix something' });
            expect(res.status).toBe(400);
        });

        it('should reject job with invalid timeSlot', async () => {
            const res = await request(app)
                .post('/api/v1/jobs')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    category: 'Plumbing',
                    timeSlot: 'invalid',
                    location: { type: 'Point', coordinates: [72.8777, 19.0760] }
                });
            expect(res.status).toBe(400);
        });
    });

    describe('Shop Validation', () => {
        let shopToken;

        beforeEach(async () => {
            const shop = await createTestUser({ role: 'SHOP', email: 'valshop@test.com', phone: '1234567890' });
            shopToken = generateToken(shop);
        });

        it('should reject shop creation without name', async () => {
            const res = await request(app)
                .post('/api/v1/shops')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ address: '123 Main St' });
            expect(res.status).toBe(400);
        });

        it('should reject shop creation without location', async () => {
            const res = await request(app)
                .post('/api/v1/shops')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ name: 'Test Shop', address: '123 Main St' });
            expect(res.status).toBe(400);
        });
    });

    describe('Product Validation', () => {
        let shopToken;

        beforeEach(async () => {
            const shop = await createTestUser({ role: 'SHOP', email: 'valprod@test.com', phone: '1234567890' });
            shopToken = generateToken(shop);
        });

        it('should reject product without name', async () => {
            const res = await request(app)
                .post('/api/v1/products')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ price: 100 });
            expect(res.status).toBe(400);
        });

        it('should reject product without price', async () => {
            const res = await request(app)
                .post('/api/v1/products')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ name: 'Milk' });
            expect(res.status).toBe(400);
        });
    });

    describe('Wallet Validation', () => {
        let customerToken;

        beforeEach(async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'valwallet@test.com', phone: '1234567890' });
            customerToken = generateToken(customer);
        });

        it('should reject topup with zero amount', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 0 });
            expect(res.status).toBe(400);
        });

        it('should reject topup with negative amount', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: -100 });
            expect(res.status).toBe(400);
        });

        it('should reject withdraw without payoutMethod', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/withdraw')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 100 });
            expect(res.status).toBe(400);
        });
    });

    describe('ShopOrder Validation', () => {
        let customerToken;

        beforeEach(async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'valorder@test.com', phone: '1234567890' });
            customerToken = generateToken(customer);
        });

        it('should reject order without shopId', async () => {
            const res = await request(app)
                .post('/api/v1/shoporders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ items: [], paymentMethod: 'WALLET' });
            expect(res.status).toBe(400);
        });

        it('should reject order with invalid paymentMethod', async () => {
            const res = await request(app)
                .post('/api/v1/shoporders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    shopId: '507f1f77bcf86cd799439011',
                    items: [{ productId: '507f1f77bcf86cd799439011', name: 'Test', price: 100, qty: 1 }],
                    deliveryAddress: '123 Main St',
                    paymentMethod: 'CASH',
                    deliveryLocation: { type: 'Point', coordinates: [77.3178, 28.5800] }
                });
            expect(res.status).toBe(400);
        });
    });

    describe('Dispute Validation', () => {
        let customerToken;

        beforeEach(async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'valdispute@test.com', phone: '1234567890' });
            customerToken = generateToken(customer);
        });

        it('should reject dispute without reason', async () => {
            const res = await request(app)
                .post('/api/v1/customers/disputes')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({});
            expect(res.status).toBe(400);
        });
    });
});
