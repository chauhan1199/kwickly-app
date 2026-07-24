const request = require('supertest');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

// Mock redis.helper BEFORE app is required
jest.mock('../helpers/redis.helper', () => ({
    initRedis: jest.fn(),
    getRedis: jest.fn(),
    setCache: jest.fn().mockResolvedValue('OK'),
    getCache: jest.fn().mockResolvedValue(null),
    delCache: jest.fn().mockResolvedValue(1),
    delCacheByPattern: jest.fn().mockResolvedValue(0),
    fetchWithCache: jest.fn(),
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLock: jest.fn()
}));

const app = require('../app');
const redisHelper = require('../helpers/redis.helper');
const AppSettings = require('../modules/settings/settings.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);

describe('Admin Branding (Public Endpoint)', () => {
    beforeEach(async () => {
        await clearCollections();
        redisHelper.getCache.mockReset();
        redisHelper.setCache.mockReset();
        redisHelper.delCache.mockReset();
        redisHelper.getCache.mockResolvedValue(null);
        redisHelper.setCache.mockResolvedValue('OK');
        redisHelper.delCache.mockResolvedValue(1);
    });

    describe('GET /api/v1/admin/settings/branding', () => {
        it('should return branding data without authentication', async () => {
            await AppSettings.create({
                isSingleton: 'CONFIG',
                branding: {
                    appName: 'Kwickly',
                    logoUrl: 'https://example.com/logo.png',
                    iconUrl: 'https://example.com/icon.png'
                }
            });

            const res = await request(app).get('/api/v1/admin/settings/branding');

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data).toHaveProperty('appName');
            expect(res.body.data).toHaveProperty('logoUrl');
            expect(res.body.data).toHaveProperty('iconUrl');
            expect(res.body.data.appName).toBe('Kwickly');
            expect(res.body.data.logoUrl).toBe('https://example.com/logo.png');
            expect(res.body.data.iconUrl).toBe('https://example.com/icon.png');
        });

        it('should return default branding when no settings exist', async () => {
            const res = await request(app).get('/api/v1/admin/settings/branding');

            expect(res.status).toBe(200);
            expect(res.body.data.appName).toBe('Kwickly');
            expect(res.body.data.logoUrl).toBe('');
            expect(res.body.data.iconUrl).toBe('');
        });

        it('should not require any authentication token', async () => {
            const res = await request(app).get('/api/v1/admin/settings/branding');
            expect(res.status).toBe(200);
        });

        it('should work for admin user', async () => {
            await AppSettings.create({
                isSingleton: 'CONFIG',
                branding: { appName: 'Kwickly Pro', logoUrl: '', iconUrl: '' }
            });

            const admin = await createTestUser({ role: 'ADMIN', email: 'brandadmin@test.com', phone: '1234567890' });
            const adminToken = generateToken(admin);

            const res = await request(app)
                .get('/api/v1/admin/settings/branding')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.appName).toBe('Kwickly Pro');
        });

        it('should work for customer user', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'brandcust@test.com', phone: '1234567891' });
            const customerToken = generateToken(customer);

            const res = await request(app)
                .get('/api/v1/admin/settings/branding')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
        });
    });
});
