const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const AppSettings = require('../modules/settings/settings.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Settings Routes', () => {
    let adminToken;

    beforeEach(async () => {
        const admin = await createTestUser({ role: 'ADMIN', email: 'settingsadmin@test.com', phone: '1234567890' });
        adminToken = generateToken(admin);

        await AppSettings.create({
            isSingleton: 'CONFIG',
            branding: { appName: 'Kwickly', logoUrl: 'logo.png', iconUrl: 'icon.png' },
            fees: { type: 'percent', amount: 12, gstPercentage: 18 }
        });
    });

    describe('GET /api/v1/settings/public', () => {
        it('should return public settings', async () => {
            const res = await request(app).get('/api/v1/settings/public');
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/settings', () => {
        it('should return settings for admin', async () => {
            const res = await request(app)
                .get('/api/v1/settings')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });

        it('should reject non-admin', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'settingc@test.com', phone: '1234567891' });
            const customerToken = generateToken(customer);

            const res = await request(app)
                .get('/api/v1/settings')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('PATCH /api/v1/settings', () => {
        it('should update settings (flat fields per validator)', async () => {
            const res = await request(app)
                .patch('/api/v1/settings')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ feeAmount: 15, feeType: 'percent', appName: 'Kwickly Pro' });
            expect(res.status).toBe(200);
        });
    });
});