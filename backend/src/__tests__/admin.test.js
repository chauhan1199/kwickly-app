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

const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

beforeAll(async () => { await setup(); await clearCollections(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Admin Routes', () => {
    let adminToken, customerToken, workerToken;

    beforeEach(async () => {
        const admin = await createTestUser({ role: 'ADMIN', email: 'admin@test.com', phone: '1234567890' });
        adminToken = generateToken(admin);

        const customer = await createTestUser({ role: 'CUSTOMER', email: 'customer@test.com', phone: '1234567891' });
        customerToken = generateToken(customer);

        const worker = await createTestUser({ role: 'WORKER', email: 'worker@test.com', phone: '1234567892' });
        workerToken = generateToken(worker);
    });

    describe('GET /api/v1/admin/stats', () => {
        it('should return platform stats', async () => {
            const res = await request(app)
                .get('/api/v1/admin/stats')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });

        it('should reject non-admin', async () => {
            const res = await request(app)
                .get('/api/v1/admin/stats')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/v1/admin/customers', () => {
        it('should return all customers', async () => {
            await createTestUser({ role: 'CUSTOMER', email: 'list@test.com', phone: '1234567893' });

            const res = await request(app)
                .get('/api/v1/admin/customers')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/admin/workers', () => {
        it('should return all workers', async () => {
            await createTestUser({ role: 'WORKER', email: 'listw@test.com', phone: '1234567894' });

            const res = await request(app)
                .get('/api/v1/admin/workers')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/v1/admin/users', () => {
        it('should create a user', async () => {
            const res = await request(app)
                .post('/api/v1/admin/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'New User', phone: '9876543295', role: 'CUSTOMER' });
            expect(res.status).toBe(201);
        });
    });

    describe('PATCH /api/v1/admin/users/:id/toggle-status', () => {
        it('should toggle user status', async () => {
            const user = await createTestUser({ role: 'CUSTOMER', email: 'toggle@test.com', phone: '1234567896' });

            const res = await request(app)
                .patch(`/api/v1/admin/users/${user._id}/toggle-status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'inactive' });
            expect(res.status).toBe(200);
        });
    });

    describe('DELETE /api/v1/admin/users/:id', () => {
        it('should delete a user', async () => {
            const user = await createTestUser({ role: 'CUSTOMER', email: 'delete@test.com', phone: '1234567897' });

            const res = await request(app)
                .delete(`/api/v1/admin/users/${user._id}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/admin/jobs/export', () => {
        it('should export jobs data', async () => {
            const res = await request(app)
                .get('/api/v1/admin/jobs/export')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/admin/payments/export', () => {
        it('should export payments data', async () => {
            const res = await request(app)
                .get('/api/v1/admin/payments/export')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/admin/payouts', () => {
        it('should return all payouts', async () => {
            const res = await request(app)
                .get('/api/v1/admin/payouts')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/admin/pending-kyc', () => {
        it('should return pending KYC users', async () => {
            const res = await request(app)
                .get('/api/v1/admin/pending-kyc')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/admin/settings/branding (Public)', () => {
        it('should return branding settings without auth', async () => {
            const res = await request(app).get('/api/v1/admin/settings/branding');
            expect(res.status).toBe(200);
        });
    });
});
