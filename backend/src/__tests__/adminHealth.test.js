const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Admin Platform Health Routes', () => {
    let adminToken, customerToken;

    beforeEach(async () => {
        const admin = await createTestUser({ role: 'ADMIN', email: 'adminhealth@test.com', phone: '5001000001' });
        adminToken = generateToken(admin);

        const customer = await createTestUser({ role: 'CUSTOMER', email: 'custhealth@test.com', phone: '5001000002' });
        customerToken = generateToken(customer);
    });

    describe('GET /api/v1/admin/health (platform data)', () => {
        it('should return platform health data', async () => {
            const res = await request(app)
                .get('/api/v1/admin/health')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('dbStatus');
            expect(res.body.data).toHaveProperty('socketStatus');
            expect(res.body.data).toHaveProperty('apiVersion');
            expect(res.body.data).toHaveProperty('connectedClients');
            expect(res.body.data).toHaveProperty('environment');
            expect(res.body.data).toHaveProperty('jobsToday');
            expect(res.body.data).toHaveProperty('ordersToday');
            expect(res.body.data).toHaveProperty('uptime');
        });
    });

    describe('GET /api/v1/admin/health (DB status)', () => {
        it('should report correct DB status when connected', async () => {
            const res = await request(app)
                .get('/api/v1/admin/health')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.dbStatus).toContain('Connected');
        });
    });

    describe('GET /api/v1/admin/health (uptime)', () => {
        it('should include uptime as a string with h and m', async () => {
            const res = await request(app)
                .get('/api/v1/admin/health')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(typeof res.body.data.uptime).toBe('string');
            expect(res.body.data.uptime).toMatch(/\d+h \d+m/);
        });
    });

    describe('GET /api/v1/admin/health (environment)', () => {
        it('should return correct environment from NODE_ENV', async () => {
            const res = await request(app)
                .get('/api/v1/admin/health')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.environment).toBe('test');
        });
    });

    describe('GET /api/v1/admin/health (non-admin)', () => {
        it('should reject non-admin', async () => {
            const res = await request(app)
                .get('/api/v1/admin/health')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/v1/admin/health (unauthenticated)', () => {
        it('should reject unauthenticated', async () => {
            const res = await request(app)
                .get('/api/v1/admin/health');
            expect(res.status).toBe(401);
        });
    });
});
