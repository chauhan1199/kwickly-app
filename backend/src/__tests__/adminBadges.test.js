const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Admin Badge Counts Routes', () => {
    let adminToken, customerToken;

    beforeEach(async () => {
        const admin = await createTestUser({ role: 'ADMIN', email: 'adminbadges@test.com', phone: '4001000001' });
        adminToken = generateToken(admin);

        const customer = await createTestUser({ role: 'CUSTOMER', email: 'custbadges@test.com', phone: '4001000002' });
        customerToken = generateToken(customer);
    });

    describe('GET /api/v1/admin/badges (badge counts)', () => {
        it('should return badge counts', async () => {
            const res = await request(app)
                .get('/api/v1/admin/badges')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('kyc');
            expect(res.body.data).toHaveProperty('payouts');
            expect(res.body.data).toHaveProperty('disputes');
            expect(res.body.data).toHaveProperty('suggestions');
            expect(res.body.data).toHaveProperty('shopKyc');
        });
    });

    describe('GET /api/v1/admin/badges (zero counts)', () => {
        it('should return correct zero counts when no data exists', async () => {
            const res = await request(app)
                .get('/api/v1/admin/badges')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.kyc).toBe(0);
            expect(res.body.data.payouts).toBe(0);
            expect(res.body.data.disputes).toBe(0);
            expect(res.body.data.suggestions).toBe(0);
            expect(res.body.data.shopKyc).toBe(0);
        });
    });

    describe('GET /api/v1/admin/badges (non-admin)', () => {
        it('should reject non-admin', async () => {
            const res = await request(app)
                .get('/api/v1/admin/badges')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/v1/admin/badges (unauthenticated)', () => {
        it('should reject unauthenticated', async () => {
            const res = await request(app)
                .get('/api/v1/admin/badges');
            expect(res.status).toBe(401);
        });
    });
});
