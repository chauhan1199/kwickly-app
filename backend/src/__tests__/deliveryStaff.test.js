// Mock Redis before loading app so auth middleware gets the mock
jest.mock('../helpers/redis.helper', () => ({
    initRedis: jest.fn(),
    getRedis: jest.fn(),
    setCache: jest.fn(),
    getCache: jest.fn(),
    delCache: jest.fn(),
    delCacheByPattern: jest.fn(),
    fetchWithCache: jest.fn(async (_key, _ttl, fetcher) => fetcher()),
    acquireLock: jest.fn().mockResolvedValue('mock-holder-id'),
    releaseLock: jest.fn()
}));

// Mock rate limiter before loading app
jest.mock('../middleware/rateLimit.middleware', () => {
    const passThrough = (req, res, next) => next();
    return {
        globalLimiter: passThrough,
        authLimiter: passThrough,
        otpSendLimiter: passThrough
    };
});

// Mock order model (referenced lazily in deliveryStaff controller)
jest.mock('../modules/order/order.model', () => ({
    findOne: jest.fn().mockImplementation((query) => {
        // Return an active order when the controller checks for active deliveries
        if (query && query.status && query.status.$in) {
            return Promise.resolve({ _id: query._id, status: 'CONFIRMED' });
        }
        return Promise.resolve(null);
    })
}), { virtual: true });

const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Shop = require('../modules/shop/shop.model');
const DeliveryStaff = require('../modules/deliveryStaff/deliveryStaff.model');
const mongoose = require('mongoose');

beforeAll(async () => { await setup(); await clearCollections(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Delivery Staff Routes', () => {
    let shopOwnerToken, shopOwnerId, shopId, customerToken;

    beforeEach(async () => {
        const ts = Date.now().toString(36);
        const shopOwner = await createTestUser({ role: 'SHOP', email: `dsowner_${ts}@test.com`, phone: `80${ts.slice(-8).padStart(8,'0')}` });
        shopOwnerToken = generateToken(shopOwner);
        shopOwnerId = shopOwner._id;

        const shop = await Shop.create({ ownerId: shopOwnerId, name: 'Test Shop' });
        shopId = shop._id;

        const customer = await createTestUser({ role: 'CUSTOMER', email: `dscust_${ts}@test.com`, phone: `81${ts.slice(-8).padStart(8,'0')}` });
        customerToken = generateToken(customer);
    });

    describe('GET /api/v1/delivery-staff', () => {
        it('should return all staff for the shop', async () => {
            await DeliveryStaff.create({ shopId, name: 'Ravi', phone: '9000000001' });
            await DeliveryStaff.create({ shopId, name: 'Suresh', phone: '9000000002' });

            const res = await request(app)
                .get('/api/v1/delivery-staff')
                .set('Authorization', `Bearer ${shopOwnerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
        });

        it('should return empty array when no staff exist', async () => {
            const res = await request(app)
                .get('/api/v1/delivery-staff')
                .set('Authorization', `Bearer ${shopOwnerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app).get('/api/v1/delivery-staff');
            expect(res.status).toBe(401);
        });

        it('should reject non-SHOP role', async () => {
            const res = await request(app)
                .get('/api/v1/delivery-staff')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });

        it('should return 404 when shop not found', async () => {
            const noShopOwner = await createTestUser({ role: 'SHOP', email: `dsnoshop_${Date.now().toString(36)}@test.com`, phone: `82${Date.now().toString(36).slice(-8).padStart(8,'0')}` });
            const noShopToken = generateToken(noShopOwner);

            const res = await request(app)
                .get('/api/v1/delivery-staff')
                .set('Authorization', `Bearer ${noShopToken}`);

            expect(res.status).toBe(404);
            expect(res.body.message).toBe('Shop not found');
        });
    });

    describe('POST /api/v1/delivery-staff', () => {
        it('should add a new staff member', async () => {
            const res = await request(app)
                .post('/api/v1/delivery-staff')
                .set('Authorization', `Bearer ${shopOwnerToken}`)
                .send({ name: 'Ravi', phone: '9000000001' });

            expect(res.status).toBe(201);
            expect(res.body.data.name).toBe('Ravi');
            expect(res.body.data.phone).toBe('9000000001');
            expect(res.body.data.shopId.toString()).toBe(shopId.toString());
        });

        it('should add a staff member without optional phone', async () => {
            const res = await request(app)
                .post('/api/v1/delivery-staff')
                .set('Authorization', `Bearer ${shopOwnerToken}`)
                .send({ name: 'Ravi' });

            expect(res.status).toBe(201);
            expect(res.body.data.name).toBe('Ravi');
            expect(res.body.data.phone).toBeUndefined();
        });

        it('should reject when name is missing', async () => {
            const res = await request(app)
                .post('/api/v1/delivery-staff')
                .set('Authorization', `Bearer ${shopOwnerToken}`)
                .send({ phone: '9000000001' });

            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Staff name is required');
        });

        it('should prevent mass assignment of extra fields', async () => {
            const res = await request(app)
                .post('/api/v1/delivery-staff')
                .set('Authorization', `Bearer ${shopOwnerToken}`)
                .send({ name: 'Ravi', phone: '9000000001', shopId: new mongoose.Types.ObjectId(), totalDeliveries: 999, averageRating: 5 });

            expect(res.status).toBe(201);
            expect(res.body.data.totalDeliveries).toBe(0);
            expect(res.body.data.averageRating).toBe(0);
            expect(res.body.data.shopId.toString()).toBe(shopId.toString());
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/delivery-staff')
                .send({ name: 'Ravi' });
            expect(res.status).toBe(401);
        });

        it('should reject non-SHOP role', async () => {
            const res = await request(app)
                .post('/api/v1/delivery-staff')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ name: 'Ravi' });
            expect(res.status).toBe(403);
        });

        it('should return 404 when shop not found', async () => {
            const noShopOwner = await createTestUser({ role: 'SHOP', email: 'noshop@test.com', phone: '1234567893' });
            const noShopToken = generateToken(noShopOwner);

            const res = await request(app)
                .post('/api/v1/delivery-staff')
                .set('Authorization', `Bearer ${noShopToken}`)
                .send({ name: 'Ravi' });

            expect(res.status).toBe(404);
            expect(res.body.message).toBe('Shop not found');
        });
    });

    describe('PATCH /api/v1/delivery-staff/:staffId', () => {
        let staffId;

        beforeEach(async () => {
            const staff = await DeliveryStaff.create({ shopId, name: 'Ravi', phone: '9000000001' });
            staffId = staff._id;
        });

        it('should update staff name', async () => {
            const res = await request(app)
                .patch(`/api/v1/delivery-staff/${staffId}`)
                .set('Authorization', `Bearer ${shopOwnerToken}`)
                .send({ name: 'Ravi Kumar' });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Ravi Kumar');
        });

        it('should update staff phone', async () => {
            const res = await request(app)
                .patch(`/api/v1/delivery-staff/${staffId}`)
                .set('Authorization', `Bearer ${shopOwnerToken}`)
                .send({ phone: '9000000099' });

            expect(res.status).toBe(200);
            expect(res.body.data.phone).toBe('9000000099');
        });

        it('should update both name and phone', async () => {
            const res = await request(app)
                .patch(`/api/v1/delivery-staff/${staffId}`)
                .set('Authorization', `Bearer ${shopOwnerToken}`)
                .send({ name: 'Ravi Kumar', phone: '9000000099' });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Ravi Kumar');
            expect(res.body.data.phone).toBe('9000000099');
        });

        it('should prevent mass assignment of extra fields', async () => {
            const res = await request(app)
                .patch(`/api/v1/delivery-staff/${staffId}`)
                .set('Authorization', `Bearer ${shopOwnerToken}`)
                .send({ name: 'Hacked', totalDeliveries: 999, averageRating: 5, shopId: new mongoose.Types.ObjectId() });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Hacked');
            expect(res.body.data.totalDeliveries).toBe(0);
            expect(res.body.data.averageRating).toBe(0);
            expect(res.body.data.shopId.toString()).toBe(shopId.toString());
        });

        it('should return 404 if staff not found', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .patch(`/api/v1/delivery-staff/${fakeId}`)
                .set('Authorization', `Bearer ${shopOwnerToken}`)
                .send({ name: 'Ghost' });

            expect(res.status).toBe(404);
            expect(res.body.message).toBe('Staff not found');
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .patch(`/api/v1/delivery-staff/${staffId}`)
                .send({ name: 'Ravi Kumar' });
            expect(res.status).toBe(401);
        });

        it('should reject non-SHOP role', async () => {
            const res = await request(app)
                .patch(`/api/v1/delivery-staff/${staffId}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ name: 'Ravi Kumar' });
            expect(res.status).toBe(403);
        });

        it('should return 404 when shop not found', async () => {
            const noShopOwner = await createTestUser({ role: 'SHOP', email: 'noshop@test.com', phone: '1234567894' });
            const noShopToken = generateToken(noShopOwner);

            const res = await request(app)
                .patch(`/api/v1/delivery-staff/${staffId}`)
                .set('Authorization', `Bearer ${noShopToken}`)
                .send({ name: 'Ravi Kumar' });

            expect(res.status).toBe(404);
            expect(res.body.message).toBe('Shop not found');
        });
    });

    describe('DELETE /api/v1/delivery-staff/:staffId', () => {
        let staffId;

        beforeEach(async () => {
            const staff = await DeliveryStaff.create({ shopId, name: 'Ravi', phone: '9000000001' });
            staffId = staff._id;
        });

        it('should remove staff member', async () => {
            const res = await request(app)
                .delete(`/api/v1/delivery-staff/${staffId}`)
                .set('Authorization', `Bearer ${shopOwnerToken}`);

            expect(res.status).toBe(200);

            const deleted = await DeliveryStaff.findById(staffId);
            expect(deleted).toBeNull();
        });

        it('should return 404 if staff not found', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .delete(`/api/v1/delivery-staff/${fakeId}`)
                .set('Authorization', `Bearer ${shopOwnerToken}`);

            expect(res.status).toBe(404);
            expect(res.body.message).toBe('Staff not found');
        });

        it('should return 400 if staff has an active delivery', async () => {
            await DeliveryStaff.findByIdAndUpdate(staffId, { activeOrderId: new mongoose.Types.ObjectId() });

            const res = await request(app)
                .delete(`/api/v1/delivery-staff/${staffId}`)
                .set('Authorization', `Bearer ${shopOwnerToken}`);

            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Cannot remove staff with active delivery');

            const stillExists = await DeliveryStaff.findById(staffId);
            expect(stillExists).not.toBeNull();
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app).delete(`/api/v1/delivery-staff/${staffId}`);
            expect(res.status).toBe(401);
        });

        it('should reject non-SHOP role', async () => {
            const res = await request(app)
                .delete(`/api/v1/delivery-staff/${staffId}`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });

        it('should return 404 when shop not found', async () => {
            const noShopOwner = await createTestUser({ role: 'SHOP', email: 'noshop@test.com', phone: '1234567895' });
            const noShopToken = generateToken(noShopOwner);

            const res = await request(app)
                .delete(`/api/v1/delivery-staff/${staffId}`)
                .set('Authorization', `Bearer ${noShopToken}`);

            expect(res.status).toBe(404);
            expect(res.body.message).toBe('Shop not found');
        });
    });
});
