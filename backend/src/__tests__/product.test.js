const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Shop = require('../modules/shop/shop.model');
const Product = require('../modules/product/product.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Product Routes', () => {
    let shopToken, customerToken, shopId;

    beforeEach(async () => {
        const shopOwner = await createTestUser({ role: 'SHOP', email: 'prodshop@test.com', phone: '1234567890' });
        shopToken = generateToken(shopOwner);

        const customer = await createTestUser({ role: 'CUSTOMER', email: 'prodcustomer@test.com', phone: '1234567891' });
        customerToken = generateToken(customer);

        const shop = await Shop.create({
            ownerId: shopOwner._id,
            name: 'Test Shop',
            address: '123 Main St',
            location: { type: 'Point', coordinates: [72.8777, 19.0760] }
        });
        shopId = shop._id;
    });

    describe('POST /api/v1/products', () => {
        it('should create a product', async () => {
            const res = await request(app)
                .post('/api/v1/products')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ name: 'Milk 1L', price: 68, stock: 50, category: 'Dairy' });
            expect(res.status).toBe(201);
            expect(res.body.data.name).toBe('Milk 1L');
        });

        it('should reject without required fields', async () => {
            const res = await request(app)
                .post('/api/v1/products')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ name: 'Milk' });
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/v1/products', () => {
        it('should return all products', async () => {
            await Product.create([
                { shopId, name: 'Milk 1L', price: 68, stock: 50 },
                { shopId, name: 'Oil 1L', price: 149, stock: 20 }
            ]);

            const res = await request(app)
                .get('/api/v1/products')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('GET /api/v1/products/shop', () => {
        it('should return shop products', async () => {
            await Product.create({ shopId, name: 'Milk 1L', price: 68, stock: 50 });

            const res = await request(app)
                .get('/api/v1/products/shop')
                .set('Authorization', `Bearer ${shopToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/products/:id', () => {
        it('should return product by id', async () => {
            const product = await Product.create({ shopId, name: 'Milk 1L', price: 68, stock: 50 });

            const res = await request(app)
                .get(`/api/v1/products/${product._id}`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('PATCH /api/v1/products/:id', () => {
        it('should update product', async () => {
            const product = await Product.create({ shopId, name: 'Old Name', price: 68, stock: 50 });

            const res = await request(app)
                .patch(`/api/v1/products/${product._id}`)
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ name: 'New Name' });
            expect(res.status).toBe(200);
        });
    });

    describe('DELETE /api/v1/products/:id', () => {
        it('should delete product', async () => {
            const product = await Product.create({ shopId, name: 'To Delete', price: 68, stock: 50 });

            const res = await request(app)
                .delete(`/api/v1/products/${product._id}`)
                .set('Authorization', `Bearer ${shopToken}`);
            expect(res.status).toBe(200);
        });
    });
});
