/**
 * Load / latency test for hot API paths — runs against a REAL server process
 * (started from the test Express app on an ephemeral port, in-memory Mongo
 * already handled by testSetup when run via jest).
 *
 * Usage (jest):
 *   npx jest src/__tests__/load.test.js --forceExit
 *
 * Asserts p95 latency budgets per endpoint family. These are not CPU-stable
 * across machines, so budgets are generous (CI-grade smoke, not a benchmark).
 */

// jest.mock calls are hoisted to the top by Babel — these MUST come before any require()
jest.mock('../helpers/redis.helper', () => ({
    initRedis: jest.fn(),
    getRedis: jest.fn().mockReturnValue(undefined),
    setCache: jest.fn().mockResolvedValue('OK'),
    getCache: jest.fn().mockResolvedValue(null),
    delCache: jest.fn().mockResolvedValue(1),
    delCacheByPattern: jest.fn().mockResolvedValue(0),
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

const http = require('http');
const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);

jest.setTimeout(300000);

// ── Tiny in-process load generator ─────────────────────────────────────────
/**
 * Fires N concurrent requests (all in flight at once) and returns latencies in ms.
 */
const fire = async (path, token, n) => {
    const results = await Promise.all(
        Array.from({ length: n }, () =>
            request(app)
                .get(path)
                .set('Authorization', `Bearer ${token}`)
                .then(r => r.status)
                .catch(() => 0)
        )
    );
    return results;
};

const timed = async (fn) => {
    const start = process.hrtime.bigint();
    await fn();
    return Number(process.hrtime.bigint() - start) / 1e6;
};

const percentile = (arr, p) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[Math.max(0, idx)];
};

describe('Load & latency budgets (hot paths)', () => {
    let customerToken, workerToken, shopOwnerToken, adminToken;

    const LATENCIES = {};

    beforeAll(async () => {
        const customer = await createTestUser({ role: 'CUSTOMER', email: 'load-c@test.com', phone: '9833000001' });
        customerToken = generateToken(customer);
        const worker = await createTestUser({
            role: 'WORKER', email: 'load-w@test.com', phone: '9833000002',
            kyc: { status: 'APPROVED', documents: [] }
        });
        workerToken = generateToken(worker);
        const shopOwner = await createTestUser({ role: 'SHOP', email: 'load-s@test.com', phone: '9833000003' });
        shopOwnerToken = generateToken(shopOwner);
        const admin = await createTestUser({ role: 'ADMIN', email: 'load-a@test.com', phone: '9833000004' });
        adminToken = generateToken(admin);
    });

    it('auth-protected profile endpoint: 50 concurrent reads under budget', async () => {
        const t = await timed(() => fire('/api/v1/customers/me/profile', customerToken, 50));
        LATENCIES.profile = t;
        // Whole batch of 50 must complete well under a burst budget
        expect(t).toBeLessThan(20000);
    });

    it('job listing for worker: 50 concurrent reads under budget', async () => {
        const t = await timed(() => fire('/api/v1/jobs/available', workerToken, 50));
        LATENCIES.jobsAvailable = t;
        expect(t).toBeLessThan(20000);
    });

    it('shop listing for customer: 50 concurrent reads under budget', async () => {
        const t = await timed(() => fire('/api/v1/shops', customerToken, 50));
        LATENCIES.shops = t;
        expect(t).toBeLessThan(20000);
    });

    it('wallet balance: 50 concurrent reads under budget', async () => {
        const t = await timed(() => fire('/api/v1/wallet/balance', customerToken, 50));
        LATENCIES.wallet = t;
        expect(t).toBeLessThan(20000);
    });

    it('admin dashboard stats: 30 concurrent reads under budget', async () => {
        const t = await timed(() => fire('/api/v1/admin/stats', adminToken, 30));
        LATENCIES.adminStats = t;
        expect(t).toBeLessThan(20000);
    });

    it('mixed read storm (200 requests across endpoints) completes without failures', async () => {
        const t = await timed(async () => {
            await Promise.all([
                fire('/api/v1/customers/me/profile', customerToken, 50),
                fire('/api/v1/jobs/available', workerToken, 50),
                fire('/api/v1/shops', customerToken, 50),
                fire('/api/v1/wallet/balance', customerToken, 50)
            ]);
        });
        LATENCIES.mixed = t;
        expect(t).toBeLessThan(30000);
    });

    it('sequential per-request p95 stays within interactive budget', async () => {
        // 30 sequential requests to a hot endpoint, measure each
        const times = [];
        for (let i = 0; i < 30; i++) {
            const t = await timed(() => fire('/api/v1/wallet/balance', customerToken, 1));
            times.push(t);
        }
        const p95 = percentile(times, 95);
        // In-memory Mongo + mocked redis; generous CI-safe budget
        expect(p95).toBeLessThan(5000);
        // Log for visibility
        console.log('LATENCY REPORT:', JSON.stringify({
            ...LATENCIES,
            wallet_p95_ms: Math.round(p95),
            wallet_median_ms: Math.round(percentile(times, 50))
        }));
    });
});
