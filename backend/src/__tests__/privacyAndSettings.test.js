// jest.mock calls are hoisted to the top by Babel — these MUST come before any require()
jest.mock('../helpers/redis.helper', () => ({
    initRedis: jest.fn(),
    getRedis: jest.fn(),
    setCache: jest.fn(),
    getCache: jest.fn(),
    delCache: jest.fn(),
    delCacheByPattern: jest.fn(),
    fetchWithCache: jest.fn(),
    acquireLock: jest.fn().mockResolvedValue('mock-holder-id'),
    releaseLock: jest.fn()
}));

jest.mock('../middleware/rateLimit.middleware', () => {
    const passThrough = (req, res, next) => next();
    return { globalLimiter: passThrough, authLimiter: passThrough, otpSendLimiter: passThrough };
});

jest.mock('../helpers/socket.helper', () => ({
    initSocket: jest.fn(),
    getIO: jest.fn(),
    emitToAll: jest.fn(),
    emitToRoom: jest.fn(),
    triggerDashboardUpdate: jest.fn(),
    emitToUser: jest.fn()
}));

jest.mock('../services/sms.service', () => ({
    sendOTP: jest.fn().mockResolvedValue('1234')
}));

const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Job = require('../modules/job/job.model');
const Quote = require('../modules/quote/quote.model');
const AppSettings = require('../modules/settings/settings.model');

// Regression tests for the second audit pass: worker data exposed to customers,
// fee config shared with the app, and the worker profile city field.

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Privacy and settings fixes', () => {
    let customer, customerToken, worker, workerToken;

    beforeEach(async () => {
        customer = await createTestUser({ role: 'CUSTOMER', email: 'pv-c@test.com', phone: '9833000001' });
        customerToken = generateToken(customer);
        worker = await createTestUser({
            role: 'WORKER', email: 'pv-w@test.com', phone: '9833000002', isOnline: true,
            kyc: { status: 'APPROVED', documents: [{ type: 'AADHAR', url: 'https://example.com/secret.jpg' }] },
            wallet: { balance: 777 },
            activeLocation: { type: 'Point', coordinates: [77.59, 12.97] }
        });
        workerToken = generateToken(worker);
    });

    test('quote list shows KYC status but not worker wallet or documents', async () => {
        const job = await Job.create({
            customerId: customer._id, category: 'Plumbing', subcategory: 'Pipe Repair', description: 'Leak',
            location: { type: 'Point', coordinates: [77.5946, 12.9716] },
            addressDetails: { city: 'Bangalore', fullAddress: '1 Main St' }, status: 'QUOTES_RECEIVED'
        });
        await Quote.create({ jobId: job._id, workerId: worker._id, amount: 550 });

        const res = await request(app).get(`/api/v1/quotes/job/${job._id}`).set('Authorization', `Bearer ${customerToken}`);
        expect(res.status).toBe(200);
        const q = res.body.data[0];
        expect(q.workerId.kyc.status).toBe('APPROVED');
        expect(q.workerId.kyc.documents).toBeUndefined();
        expect(q.workerId.wallet).toBeUndefined();
        // Tiered default: 12% of 550 = 66, GST 11.88
        expect(q.platformFee).toBe(66);
        expect(q.gst).toBe(11.88);
    });

    test('quote list uses the same fee config the server charges with', async () => {
        await AppSettings.create({ isSingleton: 'CONFIG', fees: { type: 'tiered', minFee: 50 }, serviceJobFee: { mode: 'FIXED', fixedFee: 30, gstPercent: 18 } });
        const job = await Job.create({
            customerId: customer._id, category: 'Plumbing', subcategory: 'Pipe Repair', description: 'Leak',
            location: { type: 'Point', coordinates: [77.5946, 12.9716] },
            addressDetails: { city: 'Bangalore', fullAddress: '1 Main St' }, status: 'QUOTES_RECEIVED'
        });
        await Quote.create({ jobId: job._id, workerId: worker._id, amount: 550 });
        const res = await request(app).get(`/api/v1/quotes/job/${job._id}`).set('Authorization', `Bearer ${customerToken}`);
        expect(res.body.data[0].platformFee).toBe(30);
    });

    test('public settings include the fee rules the app needs', async () => {
        const res = await request(app).get('/api/v1/settings/public');
        expect(res.status).toBe(200);
        expect(res.body.data.shopOrderFee).toEqual({ mode: 'PERCENTAGE', percentage: 5, minFee: 10, fixedFee: 10, gstPercent: 18 });
        expect(res.body.data.serviceJobFee.mode).toBe('TIERED');
    });

    test('public worker endpoints do not expose phone, wallet or KYC documents', async () => {
        const profile = await request(app).get(`/api/v1/customers/workers/${worker._id}/profile`).set('Authorization', `Bearer ${customerToken}`);
        expect(profile.status).toBe(200);
        const text = JSON.stringify(profile.body);
        expect(text).not.toContain('9833000002');
        expect(text).not.toContain('secret.jpg');
        expect(text).not.toContain('777');

        const top = await request(app).get('/api/v1/customers/top-pros').set('Authorization', `Bearer ${customerToken}`);
        expect(top.status).toBe(200);
        const topText = JSON.stringify(top.body);
        expect(topText).not.toContain('9833000002');
        expect(topText).not.toContain('secret.jpg');
    });

    test('worker profile update saves city', async () => {
        const res = await request(app).put('/api/v1/workers/me/profile')
            .set('Authorization', `Bearer ${workerToken}`)
            .send({ city: 'Pune', bio: 'Plumber' });
        expect(res.status).toBe(200);
        expect(res.body.data.city).toBe('Pune');
    });
});
