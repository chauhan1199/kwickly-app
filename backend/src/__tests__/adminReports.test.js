const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Admin Reports Routes', () => {
    let adminToken, customerToken;

    beforeEach(async () => {
        const admin = await createTestUser({ role: 'ADMIN', email: 'adminreports@test.com', phone: '6001000001' });
        adminToken = generateToken(admin);

        const customer = await createTestUser({ role: 'CUSTOMER', email: 'custreports@test.com', phone: '6001000002' });
        customerToken = generateToken(customer);
    });

    describe('GET /api/v1/admin/reports/revenue', () => {
        it('should return revenue report data', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/revenue')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('total');
            expect(res.body.data).toHaveProperty('commission');
            expect(res.body.data).toHaveProperty('payouts');
            expect(res.body.data).toHaveProperty('chartData');
        });
    });

    describe('GET /api/v1/admin/reports/revenue period=week', () => {
        it('should accept period=week query parameter', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/revenue?period=week')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('total');
        });
    });

    describe('GET /api/v1/admin/reports/revenue period=month', () => {
        it('should accept period=month query parameter', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/revenue?period=month')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/admin/reports/revenue period=quarter', () => {
        it('should accept period=quarter query parameter', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/revenue?period=quarter')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/admin/reports/revenue period=year', () => {
        it('should accept period=year query parameter', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/revenue?period=year')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/admin/reports/revenue (non-admin)', () => {
        it('should reject non-admin', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/revenue')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/v1/admin/reports/revenue (unauthenticated)', () => {
        it('should reject unauthenticated', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/revenue');
            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/v1/admin/reports/performance', () => {
        it('should return performance report data', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/performance')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('activeWorkers');
            expect(res.body.data).toHaveProperty('avgRating');
            expect(res.body.data).toHaveProperty('completionRate');
            expect(res.body.data).toHaveProperty('chartData');
        });
    });

    describe('GET /api/v1/admin/reports/performance with period', () => {
        it('should accept period parameter', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/performance?period=month')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/admin/reports/performance (non-admin)', () => {
        it('should reject non-admin', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/performance')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/v1/admin/reports/performance (unauthenticated)', () => {
        it('should reject unauthenticated', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/performance');
            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/v1/admin/reports/retention', () => {
        it('should return retention report data', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/retention')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('newCustomers');
            expect(res.body.data).toHaveProperty('returningCustomers');
            expect(res.body.data).toHaveProperty('churnRate');
            expect(res.body.data).toHaveProperty('chartData');
        });
    });

    describe('GET /api/v1/admin/reports/retention with period', () => {
        it('should accept period parameter', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/retention?period=quarter')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/admin/reports/retention (non-admin)', () => {
        it('should reject non-admin', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/retention')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/v1/admin/reports/retention (unauthenticated)', () => {
        it('should reject unauthenticated', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/retention');
            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/v1/admin/reports/demand', () => {
        it('should return demand report data', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/demand')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('topCategory');
            expect(res.body.data).toHaveProperty('totalJobs');
            expect(res.body.data).toHaveProperty('chartData');
        });
    });

    describe('GET /api/v1/admin/reports/demand with period', () => {
        it('should accept period parameter', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/demand?period=year')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/admin/reports/demand (non-admin)', () => {
        it('should reject non-admin', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/demand')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/v1/admin/reports/demand (unauthenticated)', () => {
        it('should reject unauthenticated', async () => {
            const res = await request(app)
                .get('/api/v1/admin/reports/demand');
            expect(res.status).toBe(401);
        });
    });
});
