const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Shop = require('../modules/shop/shop.model');
const Product = require('../modules/product/product.model');
const { AdminWallet } = require('../modules/adminWallet/adminWallet.model');

// Mock cloudinary
jest.mock('../services/cloudinary.service', () => ({
    uploadImage: jest.fn().mockResolvedValue({ url: 'https://res.cloudinary.com/test/image/upload/test.jpg', public_id: 'test_id' }),
    cleanupImage: jest.fn(),
    uploadBase64: jest.fn().mockResolvedValue({ url: 'https://res.cloudinary.com/test/image/upload/test_b64.jpg', public_id: 'test_b64_id' })
}));

const { uploadImage, cleanupImage } = require('../services/cloudinary.service');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);

describe('Admin Shop Management', () => {
    let adminToken, customerToken;
    let seq = 0;

    beforeEach(async () => {
        await clearCollections();
        seq++;
        const admin = await createTestUser({ role: 'ADMIN', email: `adminshop${seq}@test.com`, phone: `6100000${String(seq).padStart(4, '0')}` });
        adminToken = generateToken(admin);

        const customer = await createTestUser({ role: 'CUSTOMER', email: `custshop${seq}@test.com`, phone: `6200000${String(seq).padStart(4, '0')}` });
        customerToken = generateToken(customer);

        jest.clearAllMocks();
    });

    const createTestShop = async (overrides = {}) => {
        const owner = await createTestUser({ role: 'SHOP', email: `shopowner${Date.now()}@test.com`, phone: String(Date.now()).slice(-10) });
        return Shop.create({
            ownerId: owner._id,
            name: 'Test Shop',
            category: 'Electronics',
            description: 'A test shop',
            address: '123 Test Street',
            location: { type: 'Point', coordinates: [77.5946, 12.9716] },
            deliveryConfig: { deliveryRadiusKm: 3, deliveryCharge: 40, freeDeliveryAbove: 1000 },
            businessHours: { monFri: '9 AM - 10 PM', sat: '9 AM - 10 PM', sun: '9 AM - 10 PM' },
            subscription: { status: 'ACTIVE', isTrial: false },
            kyc: { status: 'PENDING', documents: [] },
            ...overrides
        });
    };

    // ─── GET /api/v1/admin/shops ─────────────────────────────────────────
    describe('GET /api/v1/admin/shops', () => {
        it('should return all shops', async () => {
            await createTestShop({ name: 'Shop A' });
            await createTestShop({ name: 'Shop B' });

            // Re-create admin to avoid potential first-test race condition
            const freshAdmin = await createTestUser({ role: 'ADMIN', email: 'adminshop_fresh@test.com', phone: '1111111199' });
            const freshToken = generateToken(freshAdmin);

            const res = await request(app)
                .get('/api/v1/admin/shops')
                .set('Authorization', `Bearer ${freshToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.shops.length).toBeGreaterThanOrEqual(2);
            expect(res.body.data).toHaveProperty('total');
            expect(res.body.data).toHaveProperty('page');
            expect(res.body.data).toHaveProperty('totalPages');
        });

        it('should return empty list when no shops exist', async () => {
            const res = await request(app)
                .get('/api/v1/admin/shops')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.shops).toEqual([]);
            expect(res.body.data.total).toBe(0);
        });

        it('should filter shops by search term', async () => {
            await createTestShop({ name: 'Alpha Electronics' });
            await createTestShop({ name: 'Beta Bakery' });

            const res = await request(app)
                .get('/api/v1/admin/shops?search=Alpha')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.shops.length).toBeGreaterThanOrEqual(1);
            expect(res.body.data.shops[0].name).toBe('Alpha Electronics');
        });

        it('should filter shops by KYC status', async () => {
            await createTestShop({ name: 'Pending Shop', kyc: { status: 'PENDING', documents: [] } });
            await createTestShop({ name: 'Approved Shop', kyc: { status: 'APPROVED', documents: [] } });

            const res = await request(app)
                .get('/api/v1/admin/shops?kycStatus=PENDING')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.shops.length).toBeGreaterThanOrEqual(1);
            expect(res.body.data.shops[0].kyc.status).toBe('PENDING');
        });

        it('should paginate results', async () => {
            for (let i = 0; i < 3; i++) {
                await createTestShop({ name: `Shop ${i}` });
            }

            const res = await request(app)
                .get('/api/v1/admin/shops?page=1&limit=2')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.shops.length).toBe(2);
            expect(res.body.data.total).toBe(3);
            expect(res.body.data.totalPages).toBe(2);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app).get('/api/v1/admin/shops');
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .get('/api/v1/admin/shops')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    // ─── GET /api/v1/admin/shops/:id ─────────────────────────────────────
    describe('GET /api/v1/admin/shops/:id', () => {
        it('should return shop detail with products and wallet txns', async () => {
            const shop = await createTestShop();

            const res = await request(app)
                .get(`/api/v1/admin/shops/${shop._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.shop.name).toBe('Test Shop');
            expect(res.body.data).toHaveProperty('products');
            expect(res.body.data).toHaveProperty('walletTxns');
        });

        it('should return 404 for non-existent shop', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .get(`/api/v1/admin/shops/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated request', async () => {
            const shop = await createTestShop();
            const res = await request(app).get(`/api/v1/admin/shops/${shop._id}`);
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const shop = await createTestShop();
            const res = await request(app)
                .get(`/api/v1/admin/shops/${shop._id}`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    // ─── POST /api/v1/admin/shops ────────────────────────────────────────
    describe('POST /api/v1/admin/shops', () => {
        it('should create a shop with valid data', async () => {
            const res = await request(app)
                .post('/api/v1/admin/shops')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'New Shop',
                    category: 'Fashion',
                    address: '456 Main Road',
                    ownerPhone: '9876543210',
                    ownerName: 'Shop Owner',
                    location: { type: 'Point', coordinates: [77.5946, 12.9716] }
                });

            expect(res.status).toBe(201);
            expect(res.body.data.populated.name).toBe('New Shop');
            expect(res.body.data.populated.category).toBe('Fashion');
        });

        it('should create a shop with minimal required fields', async () => {
            const res = await request(app)
                .post('/api/v1/admin/shops')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Minimal Shop',
                    category: 'Food',
                    address: '789 Side Lane',
                    ownerPhone: '9876543211'
                });

            expect(res.status).toBe(201);
        });

        it('should reject with missing name', async () => {
            const res = await request(app)
                .post('/api/v1/admin/shops')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    category: 'Food',
                    address: '789 Side Lane',
                    ownerPhone: '9876543212'
                });

            expect(res.status).toBe(400);
        });

        it('should reject with missing ownerPhone', async () => {
            const res = await request(app)
                .post('/api/v1/admin/shops')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'No Owner Shop',
                    category: 'Food',
                    address: '789 Side Lane'
                });

            expect(res.status).toBe(400);
        });

        it('should reject duplicate owner', async () => {
            const owner = await createTestUser({ role: 'SHOP', email: 'dupe@test.com', phone: '9999999999' });
            await createTestShop({ ownerId: owner._id, name: 'Existing Shop' });

            const res = await request(app)
                .post('/api/v1/admin/shops')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Duplicate Shop',
                    category: 'Food',
                    address: '111 Duplicate Lane',
                    ownerPhone: '9999999999'
                });

            expect(res.status).toBe(409);
        });

        it('should reject with invalid category length', async () => {
            const res = await request(app)
                .post('/api/v1/admin/shops')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Bad Category Shop',
                    category: 'X',
                    address: '789 Side Lane',
                    ownerPhone: '9876543213'
                });

            expect(res.status).toBe(400);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/admin/shops')
                .send({ name: 'X', category: 'Food', address: '123', ownerPhone: '9876543214' });
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .post('/api/v1/admin/shops')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ name: 'X', category: 'Food', address: '123', ownerPhone: '9876543215' });
            expect(res.status).toBe(403);
        });
    });

    // ─── PATCH /api/v1/admin/shops/:id ───────────────────────────────────
    describe('PATCH /api/v1/admin/shops/:id', () => {
        it('should update shop name', async () => {
            const shop = await createTestShop();

            const res = await request(app)
                .patch(`/api/v1/admin/shops/${shop._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Updated Shop Name' });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Updated Shop Name');
        });

        it('should update shop category and description', async () => {
            const shop = await createTestShop();

            const res = await request(app)
                .patch(`/api/v1/admin/shops/${shop._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ category: 'Fashion', description: 'Updated description' });

            expect(res.status).toBe(200);
            expect(res.body.data.category).toBe('Fashion');
            expect(res.body.data.description).toBe('Updated description');
        });

        it('should update delivery config', async () => {
            const shop = await createTestShop();

            const res = await request(app)
                .patch(`/api/v1/admin/shops/${shop._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ deliveryConfig: { deliveryCharge: 50, freeDeliveryAbove: 1500 } });

            expect(res.status).toBe(200);
        });

        it('should update subscription', async () => {
            const shop = await createTestShop();

            const res = await request(app)
                .patch(`/api/v1/admin/shops/${shop._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ subscription: { status: 'ACTIVE', isTrial: false } });

            expect(res.status).toBe(200);
        });

        it('should return 404 for non-existent shop', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .patch(`/api/v1/admin/shops/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Updated' });

            expect(res.status).toBe(404);
        });

        it('should reject with no update fields', async () => {
            const shop = await createTestShop();
            const res = await request(app)
                .patch(`/api/v1/admin/shops/${shop._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(res.status).toBe(400);
        });

        it('should reject unauthenticated request', async () => {
            const shop = await createTestShop();
            const res = await request(app)
                .patch(`/api/v1/admin/shops/${shop._id}`)
                .send({ name: 'X' });
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const shop = await createTestShop();
            const res = await request(app)
                .patch(`/api/v1/admin/shops/${shop._id}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ name: 'X' });
            expect(res.status).toBe(403);
        });
    });

    // ─── DELETE /api/v1/admin/shops/:id ──────────────────────────────────
    describe('DELETE /api/v1/admin/shops/:id', () => {
        it('should soft-delete a shop', async () => {
            const shop = await createTestShop();

            const res = await request(app)
                .delete(`/api/v1/admin/shops/${shop._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);

            const deleted = await Shop.findById(shop._id);
            expect(deleted.isDeleted).toBe(true);
            expect(deleted.deletedAt).toBeDefined();
        });

        it('should deactivate shop products on delete', async () => {
            const shop = await createTestShop();
            const product = await Product.create({ shopId: shop._id, name: 'Widget', price: 99, stock: 10 });

            await request(app)
                .delete(`/api/v1/admin/shops/${shop._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            const updatedProduct = await Product.findById(product._id);
            expect(updatedProduct.isActive).toBe(false);
        });

        it('should return 404 for non-existent shop', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .delete(`/api/v1/admin/shops/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated request', async () => {
            const shop = await createTestShop();
            const res = await request(app).delete(`/api/v1/admin/shops/${shop._id}`);
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const shop = await createTestShop();
            const res = await request(app)
                .delete(`/api/v1/admin/shops/${shop._id}`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    // ─── PATCH /api/v1/admin/shops/:id/kyc ──────────────────────────────
    describe('PATCH /api/v1/admin/shops/:id/kyc', () => {
        it('should approve shop KYC with documents', async () => {
            const shop = await createTestShop({
                kyc: { status: 'PENDING', documents: [{ name: 'aadhar.pdf', url: 'http://test.com/doc', public_id: 'doc1', docType: 'OTHER' }] }
            });

            const res = await request(app)
                .patch(`/api/v1/admin/shops/${shop._id}/kyc`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'APPROVED' });

            expect(res.status).toBe(200);
            expect(res.body.data.kyc.status).toBe('APPROVED');
        });

        it('should reject shop KYC', async () => {
            const shop = await createTestShop({ kyc: { status: 'PENDING', documents: [] } });

            const res = await request(app)
                .patch(`/api/v1/admin/shops/${shop._id}/kyc`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'REJECTED' });

            expect(res.status).toBe(200);
            expect(res.body.data.kyc.status).toBe('REJECTED');
        });

        it('should reject approval without documents', async () => {
            const shop = await createTestShop({ kyc: { status: 'PENDING', documents: [] } });

            const res = await request(app)
                .patch(`/api/v1/admin/shops/${shop._id}/kyc`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'APPROVED' });

            expect(res.status).toBe(400);
        });

        it('should return 404 for non-existent shop', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .patch(`/api/v1/admin/shops/${fakeId}/kyc`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'APPROVED' });

            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated request', async () => {
            const shop = await createTestShop();
            const res = await request(app)
                .patch(`/api/v1/admin/shops/${shop._id}/kyc`)
                .send({ status: 'APPROVED' });
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const shop = await createTestShop();
            const res = await request(app)
                .patch(`/api/v1/admin/shops/${shop._id}/kyc`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ status: 'APPROVED' });
            expect(res.status).toBe(403);
        });
    });

    // ─── PATCH /api/v1/admin/shops/:id/toggle ───────────────────────────
    describe('PATCH /api/v1/admin/shops/:id/toggle', () => {
        it('should toggle shop from online to offline', async () => {
            const shop = await createTestShop({ isOnline: true });

            const res = await request(app)
                .patch(`/api/v1/admin/shops/${shop._id}/toggle`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.isOnline).toBe(false);
        });

        it('should toggle shop from offline to online', async () => {
            const shop = await createTestShop({ isOnline: false });

            const res = await request(app)
                .patch(`/api/v1/admin/shops/${shop._id}/toggle`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.isOnline).toBe(true);
        });

        it('should return 404 for non-existent shop', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .patch(`/api/v1/admin/shops/${fakeId}/toggle`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated request', async () => {
            const shop = await createTestShop();
            const res = await request(app).patch(`/api/v1/admin/shops/${shop._id}/toggle`);
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const shop = await createTestShop();
            const res = await request(app)
                .patch(`/api/v1/admin/shops/${shop._id}/toggle`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    // ─── POST /api/v1/admin/shops/:id/wallet/credit ─────────────────────
    describe('POST /api/v1/admin/shops/:id/wallet/credit', () => {
        it('should credit shop wallet from admin wallet', async () => {
            await AdminWallet.create({ balance: 10000 });
            const shop = await createTestShop();

            const res = await request(app)
                .post(`/api/v1/admin/shops/${shop._id}/wallet/credit`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 500, description: 'Test credit' });

            expect(res.status).toBe(200);
            expect(res.body.data.shop.wallet.balance).toBe(500);
            expect(res.body.data.adminBalance).toBe(9500);
        });

        it('should reject with insufficient admin wallet balance', async () => {
            await AdminWallet.create({ balance: 100 });
            const shop = await createTestShop();

            const res = await request(app)
                .post(`/api/v1/admin/shops/${shop._id}/wallet/credit`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 500 });

            expect(res.status).toBe(400);
        });

        it('should reject with zero amount', async () => {
            await AdminWallet.create({ balance: 1000 });
            const shop = await createTestShop();

            const res = await request(app)
                .post(`/api/v1/admin/shops/${shop._id}/wallet/credit`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 0 });

            expect(res.status).toBe(400);
        });

        it('should reject with negative amount', async () => {
            await AdminWallet.create({ balance: 1000 });
            const shop = await createTestShop();

            const res = await request(app)
                .post(`/api/v1/admin/shops/${shop._id}/wallet/credit`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: -100 });

            expect(res.status).toBe(400);
        });

        it('should return 404 for non-existent shop', async () => {
            await AdminWallet.create({ balance: 1000 });
            const fakeId = '507f1f77bcf86cd799439011';

            const res = await request(app)
                .post(`/api/v1/admin/shops/${fakeId}/wallet/credit`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 100 });

            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/admin/shops/fakeid/wallet/credit')
                .send({ amount: 100 });
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .post('/api/v1/admin/shops/fakeid/wallet/credit')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 100 });
            expect(res.status).toBe(403);
        });
    });

    // ─── POST /api/v1/admin/shops/:id/wallet/debit ──────────────────────
    describe('POST /api/v1/admin/shops/:id/wallet/debit', () => {
        it('should debit shop wallet to admin wallet', async () => {
            const shop = await createTestShop({ wallet: { balance: 5000 } });

            const res = await request(app)
                .post(`/api/v1/admin/shops/${shop._id}/wallet/debit`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 1000, description: 'Test debit' });

            expect(res.status).toBe(200);
            expect(res.body.data.shop.wallet.balance).toBe(4000);
        });

        it('should reject with insufficient shop balance', async () => {
            const shop = await createTestShop({ wallet: { balance: 100 } });

            const res = await request(app)
                .post(`/api/v1/admin/shops/${shop._id}/wallet/debit`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 500 });

            expect(res.status).toBe(400);
        });

        it('should reject with zero amount', async () => {
            const shop = await createTestShop({ wallet: { balance: 1000 } });

            const res = await request(app)
                .post(`/api/v1/admin/shops/${shop._id}/wallet/debit`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 0 });

            expect(res.status).toBe(400);
        });

        it('should reject with negative amount', async () => {
            const shop = await createTestShop({ wallet: { balance: 1000 } });

            const res = await request(app)
                .post(`/api/v1/admin/shops/${shop._id}/wallet/debit`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: -100 });

            expect(res.status).toBe(400);
        });

        it('should return 404 for non-existent shop', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .post(`/api/v1/admin/shops/${fakeId}/wallet/debit`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 100 });

            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/admin/shops/fakeid/wallet/debit')
                .send({ amount: 100 });
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .post('/api/v1/admin/shops/fakeid/wallet/debit')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 100 });
            expect(res.status).toBe(403);
        });
    });

    // ─── POST /api/v1/admin/shops/:id/payout-methods ────────────────────
    describe('POST /api/v1/admin/shops/:id/payout-methods', () => {
        it('should add a bank payout method', async () => {
            const shop = await createTestShop();

            const res = await request(app)
                .post(`/api/v1/admin/shops/${shop._id}/payout-methods`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ type: 'BANK', detail: '1234567890', label: 'SBI Savings' });

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].type).toBe('BANK');
            expect(res.body.data[0].detail).toBe('1234567890');
        });

        it('should add a UPI payout method', async () => {
            const shop = await createTestShop();

            const res = await request(app)
                .post(`/api/v1/admin/shops/${shop._id}/payout-methods`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ type: 'UPI', detail: 'shop@upi', label: 'GPay' });

            expect(res.status).toBe(200);
            expect(res.body.data[0].type).toBe('UPI');
        });

        it('should add payout method to shop with empty payout methods', async () => {
            const shop = await createTestShop();

            const res = await request(app)
                .post(`/api/v1/admin/shops/${shop._id}/payout-methods`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ type: 'BANK', detail: '1234567890' });

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].type).toBe('BANK');
        });

        it('should return 404 for non-existent shop', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .post(`/api/v1/admin/shops/${fakeId}/payout-methods`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ type: 'BANK', detail: '1234567890' });

            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/admin/shops/fakeid/payout-methods')
                .send({ type: 'BANK', detail: '1234567890' });
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .post('/api/v1/admin/shops/fakeid/payout-methods')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ type: 'BANK', detail: '1234567890' });
            expect(res.status).toBe(403);
        });
    });

    // ─── PATCH /api/v1/admin/shops/:id/payout-methods/:methodId ─────────
    describe('PATCH /api/v1/admin/shops/:id/payout-methods/:methodId', () => {
        it('should edit payout method detail', async () => {
            const shop = await createTestShop();
            await request(app)
                .post(`/api/v1/admin/shops/${shop._id}/payout-methods`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ type: 'BANK', detail: '1111111111' });

            const updated = await Shop.findById(shop._id);
            const methodId = updated.payoutMethods[0]._id;

            const res = await request(app)
                .patch(`/api/v1/admin/shops/${shop._id}/payout-methods/${methodId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ detail: '2222222222', label: 'HDFC' });

            expect(res.status).toBe(200);
            expect(res.body.data[0].detail).toBe('2222222222');
            expect(res.body.data[0].label).toBe('HDFC');
        });

        it('should set a payout method as primary', async () => {
            const shop = await createTestShop();
            await request(app)
                .post(`/api/v1/admin/shops/${shop._id}/payout-methods`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ type: 'BANK', detail: '1111111111' });
            await request(app)
                .post(`/api/v1/admin/shops/${shop._id}/payout-methods`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ type: 'UPI', detail: 'shop@upi' });

            const updated = await Shop.findById(shop._id);
            const secondMethodId = updated.payoutMethods[1]._id;

            const res = await request(app)
                .patch(`/api/v1/admin/shops/${shop._id}/payout-methods/${secondMethodId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ isPrimary: true });

            expect(res.status).toBe(200);
            const methods = res.body.data;
            expect(methods.find(m => String(m._id) === String(secondMethodId)).isPrimary).toBe(true);
        });

        it('should return 404 for non-existent method', async () => {
            const shop = await createTestShop();
            const fakeMethodId = '507f1f77bcf86cd799439011';

            const res = await request(app)
                .patch(`/api/v1/admin/shops/${shop._id}/payout-methods/${fakeMethodId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ detail: 'updated' });

            expect(res.status).toBe(404);
        });

        it('should return 404 for non-existent shop', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .patch(`/api/v1/admin/shops/${fakeId}/payout-methods/someMethod`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ detail: 'updated' });

            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .patch('/api/v1/admin/shops/fakeid/payout-methods/fakemethod')
                .send({ detail: 'updated' });
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .patch('/api/v1/admin/shops/fakeid/payout-methods/fakemethod')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ detail: 'updated' });
            expect(res.status).toBe(403);
        });
    });

    // ─── DELETE /api/v1/admin/shops/:id/payout-methods/:methodId ────────
    describe('DELETE /api/v1/admin/shops/:id/payout-methods/:methodId', () => {
        it('should delete a payout method', async () => {
            const shop = await createTestShop();
            await request(app)
                .post(`/api/v1/admin/shops/${shop._id}/payout-methods`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ type: 'BANK', detail: '1111111111' });
            await request(app)
                .post(`/api/v1/admin/shops/${shop._id}/payout-methods`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ type: 'UPI', detail: 'shop@upi' });

            const updated = await Shop.findById(shop._id);
            const methodToDelete = updated.payoutMethods[0]._id;

            const res = await request(app)
                .delete(`/api/v1/admin/shops/${shop._id}/payout-methods/${methodToDelete}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
        });

        it('should return shop with empty payout methods after deleting all', async () => {
            const shop = await createTestShop();
            await request(app)
                .post(`/api/v1/admin/shops/${shop._id}/payout-methods`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ type: 'BANK', detail: '1111111111' });

            const updated = await Shop.findById(shop._id);
            const methodId = updated.payoutMethods[0]._id;

            const res = await request(app)
                .delete(`/api/v1/admin/shops/${shop._id}/payout-methods/${methodId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });

        it('should return 404 for non-existent shop', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .delete(`/api/v1/admin/shops/${fakeId}/payout-methods/someMethod`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .delete('/api/v1/admin/shops/fakeid/payout-methods/fakemethod');
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .delete('/api/v1/admin/shops/fakeid/payout-methods/fakemethod')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });
});
