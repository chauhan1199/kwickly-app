const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Payout = require('../modules/payout/payout.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Payout Routes', () => {
    let adminToken, customerToken;

    beforeEach(async () => {
        const admin = await createTestUser({ role: 'ADMIN', email: 'payoutadmin@test.com', phone: '1234567890' });
        adminToken = generateToken(admin);

        const customer = await createTestUser({ role: 'CUSTOMER', email: 'payoutcustomer@test.com', phone: '1234567891' });
        customerToken = generateToken(customer);
    });

    describe('GET /api/v1/payouts', () => {
        it('should return all payouts for admin', async () => {
            const res = await request(app)
                .get('/api/v1/payouts')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });

        it('should reject non-admin', async () => {
            const res = await request(app)
                .get('/api/v1/payouts')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('PATCH /api/v1/payouts/:id/status', () => {
        it('should update payout status', async () => {
            const payout = await Payout.create({
                workerId: '507f1f77bcf86cd799439011',
                amount: 1000,
                status: 'PENDING',
                paymentMethod: 'UPI',
                paymentDetails: 'test@upi'
            });

            const res = await request(app)
                .patch(`/api/v1/payouts/${payout._id}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'APPROVED' });
            expect(res.status).toBe(200);
        });
    });
});
