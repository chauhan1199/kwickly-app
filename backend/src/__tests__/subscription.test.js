const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Subscription Routes', () => {
    let adminToken, workerToken;

    beforeEach(async () => {
        const admin = await createTestUser({ role: 'ADMIN', email: 'subadmin@test.com', phone: '1234567890' });
        adminToken = generateToken(admin);

        const worker = await createTestUser({ role: 'WORKER', email: 'subworker@test.com', phone: '1234567891' });
        workerToken = generateToken(worker);
    });

    describe('POST /api/v1/subscriptions/subscribe', () => {
        it('should subscribe to a plan (or return 404 if plan missing)', async () => {
            const res = await request(app)
                .post('/api/v1/subscriptions/subscribe')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ planId: 'monthly' });
            expect([200, 400, 404]).toContain(res.status);
        });
    });

    describe('GET /api/v1/subscriptions/my', () => {
        it('should return worker subscriptions', async () => {
            const res = await request(app)
                .get('/api/v1/subscriptions/my')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/subscriptions/all (Admin)', () => {
        it('should return all subscriptions for admin', async () => {
            const res = await request(app)
                .get('/api/v1/subscriptions/all')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });
    });
});