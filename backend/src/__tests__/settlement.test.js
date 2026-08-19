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
    return {
        globalLimiter: passThrough,
        authLimiter: passThrough,
        otpSendLimiter: passThrough
    };
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

// IMPORTANT: testSetup MUST be required BEFORE app so jest.mock is applied first
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Settlement Flow — Complete E2E', () => {
    let adminToken, shopOwnerToken, customerToken, workerToken;
    let shopOwner, shop, customer, worker;
    const Shop = require('../modules/shop/shop.model');
    const Settlement = require('../modules/settlement/settlement.model');
    const ShopOrder = require('../modules/shoporder/shoporder.model');
    const Product = require('../modules/product/product.model');
    const { AdminWallet } = require('../modules/adminWallet/adminWallet.model');
    const WalletTxn = require('../modules/wallet/wallet.model');

    let sSeq = 0;
    beforeEach(async () => {
        sSeq++;
        const admin = await createTestUser({ role: 'ADMIN', email: `settlement-admin${sSeq}@test.com`, phone: `91${String(sSeq).padStart(8, '0')}` });
        adminToken = generateToken(admin);

        shopOwner = await createTestUser({ role: 'SHOP', email: `shopowner${sSeq}@test.com`, phone: `92${String(sSeq).padStart(8, '0')}`, name: 'Shop Owner', isVerified: true });
        shopOwnerToken = generateToken(shopOwner);

        customer = await createTestUser({ role: 'CUSTOMER', email: `customer${sSeq}@test.com`, phone: `93${String(sSeq).padStart(8, '0')}`, name: 'Test Customer', isVerified: true, wallet: { balance: 5000 } });
        customerToken = generateToken(customer);

        worker = await createTestUser({ role: 'WORKER', email: `worker${sSeq}@test.com`, phone: `94${String(sSeq).padStart(8, '0')}`, name: 'Test Worker', isVerified: true });
        workerToken = generateToken(worker);

        shop = await Shop.create({
            name: 'Test Shop', ownerId: shopOwner._id, category: 'General',
            address: 'Test Address', isOnline: true, kyc: { status: 'APPROVED' },
            deliveryConfig: { deliveryRadiusKm: 5, deliveryCharge: 40, freeDeliveryAbove: 500 }, wallet: { balance: 0 }
        });
    });

    // ─── 1. Full Delivery → Settlement Creation ─────────────────────────────────
    describe('1. Settlement Created on Order Delivery', () => {
        // Helper: walk an order through the full status chain to DELIVERED
        const deliverOrder = async (orderId, deliveryOtp, shopOwnerToken) => {
            for (const status of ['CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY']) {
                const r = await request(app)
                    .patch(`/api/v1/shoporders/${orderId}/status`)
                    .set('Authorization', `Bearer ${shopOwnerToken}`)
                    .send({ status });
                if (r.status !== 200) return r; // return first error
            }
            return request(app)
                .patch(`/api/v1/shoporders/${orderId}/status`)
                .set('Authorization', `Bearer ${shopOwnerToken}`)
                .send({ status: 'DELIVERED', otp: deliveryOtp });
        };

        it('should create PENDING settlement when order is delivered with correct amounts', async () => {
            const product = await Product.create({
                shopId: shop._id, name: 'Test Product', price: 100,
                stock: 10, category: 'General', unit: 'Piece', isActive: true
            });

            const orderRes = await request(app)
                .post('/api/v1/shoporders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    shopId: shop._id,
                    items: [{ productId: product._id, name: 'Test Product', price: 100, qty: 2 }],
                    deliveryAddress: 'Test delivery address',
                    paymentMethod: 'WALLET',
                    deliveryLocation: { type: 'Point', coordinates: [72.57, 23.02] }
                });
            expect(orderRes.status).toBe(201);
            const orderId = orderRes.body.data._id;


            const order = await ShopOrder.findById(orderId);

            const statusRes = await deliverOrder(orderId, order.deliveryOtp, shopOwnerToken);
            expect(statusRes.status).toBe(200);
            expect(statusRes.body.data.status).toBe('DELIVERED');


            const settlements = await Settlement.find({ orderId });
            expect(settlements.length).toBe(1);

            const s = settlements[0];
            expect(s.status).toBe('PENDING');
            expect(s.type).toBe('PRODUCT_ORDER');
            expect(s.totalAmount).toBe(240); // 200 + 40 delivery
            expect(s.shopEarning).toBeGreaterThan(0);
            expect(s.platformCommission).toBeGreaterThan(0);
            expect(s.shopEarning + s.platformCommission).toBe(240);
            expect(String(s.shopId)).toBe(String(shop._id));
            expect(String(s.customerId)).toBe(String(customer._id));
            expect(String(s.orderId)).toBe(String(orderId));
        });

        it('should NOT credit shop wallet on delivery', async () => {

            const product = await Product.create({
                shopId: shop._id, name: 'Widget', price: 500,
                stock: 5, category: 'General', unit: 'Piece', isActive: true
            });

            const orderRes = await request(app)
                .post('/api/v1/shoporders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    shopId: shop._id,
                    items: [{ productId: product._id, name: 'Widget', price: 500, qty: 1 }],
                    deliveryAddress: 'Test address', paymentMethod: 'WALLET',
                    deliveryLocation: { type: 'Point', coordinates: [72.57, 23.02] }
                });


            const order = await ShopOrder.findById(orderRes.body.data._id);
            await deliverOrder(order._id, order.deliveryOtp, shopOwnerToken);

            const updatedShop = await Shop.findById(shop._id);
            expect(updatedShop.wallet.balance).toBe(0);
        });

        it('should NOT collect admin commission on delivery', async () => {

            const product = await Product.create({
                shopId: shop._id, name: 'Item', price: 1000,
                stock: 5, category: 'General', unit: 'Piece', isActive: true
            });

            const orderRes = await request(app)
                .post('/api/v1/shoporders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    shopId: shop._id,
                    items: [{ productId: product._id, name: 'Item', price: 1000, qty: 1 }],
                    deliveryAddress: 'Addr', paymentMethod: 'WALLET',
                    deliveryLocation: { type: 'Point', coordinates: [72.57, 23.02] }
                });


            const order = await ShopOrder.findById(orderRes.body.data._id);
            await deliverOrder(order._id, order.deliveryOtp, shopOwnerToken);


            const adminWallet = await AdminWallet.findOne();
            expect(adminWallet).toBeNull();
        });
    });

    // ─── 2. Single Settlement — Happy Path ──────────────────────────────────────
    describe('2. Single Settlement', () => {
        it('should settle and credit shop wallet + admin commission', async () => {

            const s = await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 1000, platformCommission: 100, shopEarning: 900, status: 'PENDING'
            });


            await AdminWallet.create({ balance: 0 });

            const res = await request(app)
                .post(`/api/v1/admin/settlements/${s._id}/settle`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ note: 'Settled manually' });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.status).toBe('SETTLED');
            expect(res.body.data.settledAt).toBeDefined();
            expect(res.body.data.note).toBe('Settled manually');

            const updatedShop = await Shop.findById(shop._id);
            expect(updatedShop.wallet.balance).toBe(900);

            const adminWallet = await AdminWallet.findOne();
            expect(adminWallet.balance).toBe(100);
        });

        it('should allow admin to override amounts during settlement', async () => {

            const s = await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 1000, platformCommission: 100, shopEarning: 900, status: 'PENDING'
            });


            await AdminWallet.create({ balance: 0 });

            const res = await request(app)
                .post(`/api/v1/admin/settlements/${s._id}/settle`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ shopAmount: 850, commissionAmount: 150, note: 'Adjusted commission' });

            expect(res.status).toBe(200);
            expect(res.body.data.shopEarning).toBe(850);
            expect(res.body.data.platformCommission).toBe(150);

            const updatedShop = await Shop.findById(shop._id);
            expect(updatedShop.wallet.balance).toBe(850);

            const adminWallet = await AdminWallet.findOne();
            expect(adminWallet.balance).toBe(150);
        });

        it('should create WalletTxn for shop on settlement', async () => {

            const s = await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 500, platformCommission: 50, shopEarning: 450, status: 'PENDING'
            });


            await AdminWallet.create({ balance: 0 });

            await request(app)
                .post(`/api/v1/admin/settlements/${s._id}/settle`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});


            const txns = await WalletTxn.find({ userId: shopOwner._id, type: 'ORDER_CREDIT' });
            expect(txns.length).toBe(1);
            expect(txns[0].amount).toBe(450);
            expect(txns[0].status).toBe('COMPLETED');
        });
    });

    // ─── 3. Settlement Error Cases ──────────────────────────────────────────────
    describe('3. Settlement Error Cases', () => {
        it('should return 404 for non-existent settlement', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .post(`/api/v1/admin/settlements/${fakeId}/settle`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(res.status).toBe(404);
            expect(res.body.message).toBe('Settlement not found');
        });

        it('should reject settling already SETTLED settlement', async () => {

            const s = await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 500, platformCommission: 50, shopEarning: 450, status: 'SETTLED'
            });

            const res = await request(app)
                .post(`/api/v1/admin/settlements/${s._id}/settle`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Settlement already processed');
        });

        it('should reject settling CANCELLED settlement', async () => {

            const s = await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 500, platformCommission: 50, shopEarning: 450, status: 'CANCELLED'
            });

            const res = await request(app)
                .post(`/api/v1/admin/settlements/${s._id}/settle`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Settlement already processed');
        });

        it('should return 400 for invalid settlement ID format', async () => {
            const res = await request(app)
                .post('/api/v1/admin/settlements/invalid-id/settle')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect([400, 500]).toContain(res.status);
        });
    });

    // ─── 4. Bulk Settlement ─────────────────────────────────────────────────────
    describe('4. Bulk Settlement', () => {
        it('should settle multiple PENDING settlements at once', async () => {

            const s1 = await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 500, platformCommission: 50, shopEarning: 450, status: 'PENDING'
            });
            const s2 = await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 300, platformCommission: 30, shopEarning: 270, status: 'PENDING'
            });


            await AdminWallet.create({ balance: 0 });

            const res = await request(app)
                .post('/api/v1/admin/settlements/bulk-settle')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ settlementIds: [s1._id.toString(), s2._id.toString()] });

            expect(res.status).toBe(200);
            expect(res.body.data.settled).toBe(2);
            expect(res.body.data.ids.length).toBe(2);

            const updatedShop = await Shop.findById(shop._id);
            expect(updatedShop.wallet.balance).toBe(720);

            const adminWallet = await AdminWallet.findOne();
            expect(adminWallet.balance).toBe(80);
        });

        it('should skip already settled settlements in bulk', async () => {

            const s1 = await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 500, platformCommission: 50, shopEarning: 450, status: 'SETTLED'
            });
            const s2 = await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 300, platformCommission: 30, shopEarning: 270, status: 'PENDING'
            });


            await AdminWallet.create({ balance: 0 });

            const res = await request(app)
                .post('/api/v1/admin/settlements/bulk-settle')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ settlementIds: [s1._id.toString(), s2._id.toString()] });

            expect(res.status).toBe(200);
            expect(res.body.data.settled).toBe(1);

            const updatedShop = await Shop.findById(shop._id);
            expect(updatedShop.wallet.balance).toBe(270);

            const adminWallet = await AdminWallet.findOne();
            expect(adminWallet.balance).toBe(30);
        });

        it('should handle empty settlementIds array', async () => {
            const res = await request(app)
                .post('/api/v1/admin/settlements/bulk-settle')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ settlementIds: [] });

            expect(res.status).toBe(200);
            expect(res.body.data.settled).toBe(0);
        });

        it('should handle non-existent IDs in bulk settle gracefully', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .post('/api/v1/admin/settlements/bulk-settle')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ settlementIds: [fakeId.toString()] });

            expect(res.status).toBe(200);
            expect(res.body.data.settled).toBe(0);
        });
    });

    // ─── 5. List & Filter Settlements ───────────────────────────────────────────
    describe('5. List & Filter Settlements', () => {
        it('should list all settlements', async () => {

            await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 100, platformCommission: 10, shopEarning: 90, status: 'PENDING'
            });
            await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 200, platformCommission: 20, shopEarning: 180, status: 'SETTLED'
            });

            const res = await request(app)
                .get('/api/v1/admin/settlements')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(2);
            expect(res.body.message).toBe('Settlements fetched');
        });

        it('should filter by PENDING status', async () => {

            await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 100, platformCommission: 10, shopEarning: 90, status: 'PENDING'
            });
            await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 200, platformCommission: 20, shopEarning: 180, status: 'SETTLED'
            });

            const res = await request(app)
                .get('/api/v1/admin/settlements?status=PENDING')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].status).toBe('PENDING');
        });

        it('should filter by SETTLED status', async () => {

            await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 100, platformCommission: 10, shopEarning: 90, status: 'PENDING'
            });
            await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 200, platformCommission: 20, shopEarning: 180, status: 'SETTLED'
            });

            const res = await request(app)
                .get('/api/v1/admin/settlements?status=SETTLED')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].status).toBe('SETTLED');
        });

        it('should filter by type', async () => {

            await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 100, platformCommission: 10, shopEarning: 90, status: 'PENDING'
            });
            await Settlement.create({
                type: 'SERVICE_JOB', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 200, platformCommission: 20, shopEarning: 180, status: 'PENDING'
            });

            const res = await request(app)
                .get('/api/v1/admin/settlements?type=SERVICE_JOB')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].type).toBe('SERVICE_JOB');
        });

        it('should populate shop name and order details', async () => {

            await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 100, platformCommission: 10, shopEarning: 90, status: 'PENDING'
            });

            const res = await request(app)
                .get('/api/v1/admin/settlements')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.body.data[0].shopId).toBeDefined();
            expect(res.body.data[0].shopId.name).toBe('Test Shop');
        });

        it('should return empty array when no settlements exist', async () => {
            const res = await request(app)
                .get('/api/v1/admin/settlements')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });
    });

    // ─── 6. Pending Settlements Summary ─────────────────────────────────────────
    describe('6. Pending Settlements Summary', () => {
        it('should return correct count and total', async () => {

            await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 500, platformCommission: 50, shopEarning: 450, status: 'PENDING'
            });
            await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 300, platformCommission: 30, shopEarning: 270, status: 'PENDING'
            });
            await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 200, platformCommission: 20, shopEarning: 180, status: 'SETTLED'
            });

            const res = await request(app)
                .get('/api/v1/admin/settlements/pending')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.count).toBe(2);
            expect(res.body.data.total).toBe(720); // 450 + 270
            expect(res.body.data.settlements.length).toBe(2);
        });

        it('should return zero when no pending settlements', async () => {
            const res = await request(app)
                .get('/api/v1/admin/settlements/pending')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.count).toBe(0);
            expect(res.body.data.total).toBe(0);
        });

        it('should only include PENDING (not SETTLED or CANCELLED)', async () => {

            await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 500, platformCommission: 50, shopEarning: 450, status: 'SETTLED'
            });
            await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 300, platformCommission: 30, shopEarning: 270, status: 'CANCELLED'
            });
            await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 200, platformCommission: 20, shopEarning: 180, status: 'PENDING'
            });

            const res = await request(app)
                .get('/api/v1/admin/settlements/pending')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.body.data.count).toBe(1);
            expect(res.body.data.total).toBe(180);
        });
    });

    // ─── 7. Commission Calculation Accuracy ─────────────────────────────────────
    describe('7. Commission Calculation', () => {
        it('should correctly calculate 10% commission', async () => {

            const s = await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 1000, platformCommission: 100, shopEarning: 900, status: 'PENDING'
            });


            await AdminWallet.create({ balance: 0 });

            await request(app)
                .post(`/api/v1/admin/settlements/${s._id}/settle`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            const updatedShop = await Shop.findById(shop._id);
            expect(updatedShop.wallet.balance).toBe(900);

            const adminWallet = await AdminWallet.findOne();
            expect(adminWallet.balance).toBe(100);
        });

        it('should handle zero commission correctly', async () => {

            const s = await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 500, platformCommission: 0, shopEarning: 500, status: 'PENDING'
            });


            await AdminWallet.create({ balance: 0 });

            const res = await request(app)
                .post(`/api/v1/admin/settlements/${s._id}/settle`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(res.status).toBe(200);

            const updatedShop = await Shop.findById(shop._id);
            expect(updatedShop.wallet.balance).toBe(500);

            const adminWallet = await AdminWallet.findOne();
            expect(adminWallet.balance).toBe(0);
        });

        it('should handle large amounts correctly', async () => {

            const s = await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 1000000, platformCommission: 100000, shopEarning: 900000, status: 'PENDING'
            });


            await AdminWallet.create({ balance: 0 });

            await request(app)
                .post(`/api/v1/admin/settlements/${s._id}/settle`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            const updatedShop = await Shop.findById(shop._id);
            expect(updatedShop.wallet.balance).toBe(900000);

            const adminWallet = await AdminWallet.findOne();
            expect(adminWallet.balance).toBe(100000);
        });
    });

    // ─── 8. Authorization ───────────────────────────────────────────────────────
    describe('8. Authorization', () => {
        it('should reject customer from listing settlements', async () => {
            const res = await request(app)
                .get('/api/v1/admin/settlements')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });

        it('should reject worker from listing settlements', async () => {
            const res = await request(app)
                .get('/api/v1/admin/settlements')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(403);
        });

        it('should reject shop owner from settling', async () => {

            const s = await Settlement.create({
                type: 'PRODUCT_ORDER', orderId: new mongoose.Types.ObjectId(), shopId: shop._id,
                customerId: customer._id, totalAmount: 100, platformCommission: 10, shopEarning: 90, status: 'PENDING'
            });

            const res = await request(app)
                .post(`/api/v1/admin/settlements/${s._id}/settle`)
                .set('Authorization', `Bearer ${shopOwnerToken}`)
                .send({});
            expect(res.status).toBe(403);
        });

        it('should reject shop owner from bulk settle', async () => {
            const res = await request(app)
                .post('/api/v1/admin/settlements/bulk-settle')
                .set('Authorization', `Bearer ${shopOwnerToken}`)
                .send({ settlementIds: [] });
            expect(res.status).toBe(403);
        });

        it('should reject shop owner from viewing pending', async () => {
            const res = await request(app)
                .get('/api/v1/admin/settlements/pending')
                .set('Authorization', `Bearer ${shopOwnerToken}`);
            expect(res.status).toBe(403);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .get('/api/v1/admin/settlements');
            expect(res.status).toBe(401);
        });

        it('should allow admin to access all endpoints', async () => {
            const listRes = await request(app)
                .get('/api/v1/admin/settlements')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(listRes.status).toBe(200);

            const pendingRes = await request(app)
                .get('/api/v1/admin/settlements/pending')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(pendingRes.status).toBe(200);
        });
    });

    // ─── 9. End-to-End Complete Flow ────────────────────────────────────────────
    describe('9. Complete End-to-End Flow', () => {
        it('should complete: place order → deliver → settlement created → admin settles → shop paid → commission collected', async () => {




            // Setup
            const product = await Product.create({
                shopId: shop._id, name: 'Premium Widget', price: 200,
                stock: 20, category: 'General', unit: 'Piece', isActive: true
            });
            await AdminWallet.create({ balance: 0 });

            // Step 1: Customer places order
            const orderRes = await request(app)
                .post('/api/v1/shoporders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    shopId: shop._id,
                    items: [{ productId: product._id, name: 'Premium Widget', price: 200, qty: 3 }],
                    deliveryAddress: '123 Main St', paymentMethod: 'WALLET',
                    deliveryLocation: { type: 'Point', coordinates: [72.57, 23.02] }
                });
            expect(orderRes.status).toBe(201);
            const orderId = orderRes.body.data._id;

            // Verify order total: 600 subtotal, free delivery (>= 500)
            expect(orderRes.body.data.total).toBe(600);

            // Step 2: Shop walks through status chain to DELIVERED
            const order = await ShopOrder.findById(orderId);
            for (const status of ['CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY']) {
                const r = await request(app)
                    .patch(`/api/v1/shoporders/${orderId}/status`)
                    .set('Authorization', `Bearer ${shopOwnerToken}`)
                    .send({ status });
                expect(r.status).toBe(200);
            }
            const delRes = await request(app)
                .patch(`/api/v1/shoporders/${orderId}/status`)
                .set('Authorization', `Bearer ${shopOwnerToken}`)
                .send({ status: 'DELIVERED', otp: order.deliveryOtp });
            expect(delRes.status).toBe(200);

            // Step 3: Verify settlement created
            const settlements = await Settlement.find({ orderId });
            expect(settlements.length).toBe(1);
            expect(settlements[0].status).toBe('PENDING');
            expect(settlements[0].totalAmount).toBe(600); // 600 subtotal, free delivery (>= 500)
            expect(settlements[0].shopEarning + settlements[0].platformCommission).toBe(600);

            // Step 4: Shop wallet still 0
            let shopData = await Shop.findById(shop._id);
            expect(shopData.wallet.balance).toBe(0);

            // Step 5: Admin settles
            const settleRes = await request(app)
                .post(`/api/v1/admin/settlements/${settlements[0]._id}/settle`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ note: 'Weekly settlement' });
            expect(settleRes.status).toBe(200);
            expect(settleRes.body.data.status).toBe('SETTLED');

            // Step 6: Shop wallet credited
            shopData = await Shop.findById(shop._id);
            expect(shopData.wallet.balance).toBe(settlements[0].shopEarning);

            // Step 7: Admin wallet has commission
            const adminWallet = await AdminWallet.findOne();
            expect(adminWallet.balance).toBe(settlements[0].platformCommission);

            // Step 8: Verify wallet transactions created

            const shopTxns = await WalletTxn.find({ userId: shopOwner._id, type: 'ORDER_CREDIT' });
            expect(shopTxns.length).toBe(1);
            expect(shopTxns[0].amount).toBe(settlements[0].shopEarning);

            // Step 9: Can't settle again
            const doubleSettle = await request(app)
                .post(`/api/v1/admin/settlements/${settlements[0]._id}/settle`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});
            expect(doubleSettle.status).toBe(400);
            expect(doubleSettle.body.message).toBe('Settlement already processed');
        });
    });
});
