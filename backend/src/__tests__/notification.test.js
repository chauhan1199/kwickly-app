const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Notification Routes', () => {
    let adminToken, customerToken;

    beforeEach(async () => {
        const admin = await createTestUser({ role: 'ADMIN', email: 'notifadmin@test.com', phone: '1234567890' });
        adminToken = generateToken(admin);

        const customer = await createTestUser({ role: 'CUSTOMER', email: 'notifcustomer@test.com', phone: '1234567891' });
        customerToken = generateToken(customer);
    });

    describe('GET /api/v1/notifications', () => {
        it('should return notifications for admin', async () => {
            const res = await request(app)
                .get('/api/v1/notifications')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });

        it('should reject non-admin', async () => {
            const res = await request(app)
                .get('/api/v1/notifications')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/v1/notifications/my', () => {
        it('should return user notifications', async () => {
            const res = await request(app)
                .get('/api/v1/notifications/my')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/v1/notifications/broadcast', () => {
        it('should send broadcast as admin', async () => {
            const res = await request(app)
                .post('/api/v1/notifications/broadcast')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ title: 'Test Broadcast', message: 'Hello everyone' });
            expect([200, 201]).toContain(res.status);
        });
    });

    describe('PATCH /api/v1/notifications/read-all', () => {
        it('should mark all as read', async () => {
            const res = await request(app)
                .patch('/api/v1/notifications/read-all')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
        });
    });
});
