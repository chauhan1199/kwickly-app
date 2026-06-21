const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Customer Routes', () => {
    let customerToken, workerToken;

    beforeEach(async () => {
        const customer = await createTestUser({ role: 'CUSTOMER', email: 'customer@test.com', phone: '1234567890' });
        customerToken = generateToken(customer);

        const worker = await createTestUser({ role: 'WORKER', email: 'worker@test.com', phone: '1234567891' });
        workerToken = generateToken(worker);
    });

    describe('GET /api/v1/customers/me/profile', () => {
        it('should return customer profile', async () => {
            const res = await request(app)
                .get('/api/v1/customers/me/profile')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app).get('/api/v1/customers/me/profile');
            expect(res.status).toBe(401);
        });

        it('should reject non-customer role', async () => {
            const res = await request(app)
                .get('/api/v1/customers/me/profile')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/v1/customers/top-pros', () => {
        it('should return top pros list', async () => {
            const res = await request(app)
                .get('/api/v1/customers/top-pros')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/customers/jobs/active', () => {
        it('should return active job', async () => {
            const res = await request(app)
                .get('/api/v1/customers/jobs/active')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
        });
    });
});
