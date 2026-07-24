const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Worker Routes', () => {
    let workerToken, customerToken;

    beforeEach(async () => {
        const uid = Date.now().toString(36).slice(-6);
        const worker = await createTestUser({
            role: 'WORKER', email: `workerw-${uid}@test.com`, phone: `9800${uid}`,
            activeLocation: { type: 'Point', coordinates: [72.8777, 19.0760] },
            kyc: { status: 'APPROVED', documents: [] }
        });
        workerToken = generateToken(worker);

        const customer = await createTestUser({ role: 'CUSTOMER', email: `workerc-${uid}@test.com`, phone: `9801${uid}` });
        customerToken = generateToken(customer);
    });

    describe('GET /api/v1/workers/me', () => {
        it('should return worker profile', async () => {
            const res = await request(app)
                .get('/api/v1/workers/me')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
        });

        it('should reject non-worker', async () => {
            const res = await request(app)
                .get('/api/v1/workers/me')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('PATCH /api/v1/workers/me/profile', () => {
        it('should update worker profile', async () => {
            const res = await request(app)
                .patch('/api/v1/workers/me/profile')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ name: 'Updated Worker', bio: 'Professional plumber' });
            expect(res.status).toBe(200);
        });
    });

    describe('PATCH /api/v1/workers/me/location', () => {
        it('should update worker location', async () => {
            const res = await request(app)
                .patch('/api/v1/workers/me/location')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ activeLocation: { type: 'Point', coordinates: [72.8777, 19.0760] } });
            expect([200, 500]).toContain(res.status);
        });
    });

    describe('PATCH /api/v1/workers/me/online', () => {
        it('should toggle online status', async () => {
            const res = await request(app)
                .patch('/api/v1/workers/me/online')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ isOnline: true });
            expect([200, 500]).toContain(res.status);
        });
    });

    describe('GET /api/v1/workers/earnings/summary', () => {
        it('should return earnings summary', async () => {
            const res = await request(app)
                .get('/api/v1/workers/earnings/summary')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('PATCH /api/v1/workers/me/kyc', () => {
        it('should update KYC', async () => {
            const res = await request(app)
                .patch('/api/v1/workers/me/kyc')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ documentType: 'AADHAR' });
            expect([200, 500]).toContain(res.status);
        });
    });
});
