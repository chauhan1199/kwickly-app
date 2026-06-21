const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Chat Routes', () => {
    let customerToken, workerToken;

    beforeEach(async () => {
        const customer = await createTestUser({ role: 'CUSTOMER', email: 'chatc@test.com', phone: '1234567890' });
        customerToken = generateToken(customer);

        const worker = await createTestUser({ role: 'WORKER', email: 'chatw@test.com', phone: '1234567891' });
        workerToken = generateToken(worker);
    });

    describe('GET /api/v1/chat/history', () => {
        it('should return chat history', async () => {
            const res = await request(app)
                .get('/api/v1/chat/history')
                .set('Authorization', `Bearer ${customerToken}`)
                .query({ partnerId: '507f1f77bcf86cd799439011' });
            expect(res.status).toBe(200);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app).get('/api/v1/chat/history');
            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/v1/chat/send', () => {
        it('should send message or reject with validation error', async () => {
            const res = await request(app)
                .post('/api/v1/chat/send')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ receiverId: '507f1f77bcf86cd799439011', text: 'Hello' });
            expect([200, 400]).toContain(res.status);
        });
    });
});
