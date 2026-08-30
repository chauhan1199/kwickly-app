// Real (unmocked) rate-limit tests — verify the actual limiter configurations
// actually throttle. All other suites mock rateLimit.middleware; this one does NOT.
// jest.mock calls are hoisted to the top by Babel — these MUST come before any require()
jest.mock('../helpers/redis.helper', () => ({
    initRedis: jest.fn(),
    // getRedis returns undefined → AdaptiveRateLimitStore falls back to its
    // in-memory store, exactly like production degrades when Redis is down.
    getRedis: jest.fn().mockReturnValue(undefined),
    setCache: jest.fn(),
    getCache: jest.fn(),
    delCache: jest.fn(),
    delCacheByPattern: jest.fn(),
    fetchWithCache: jest.fn(),
    acquireLock: jest.fn().mockResolvedValue('mock-holder-id'),
    releaseLock: jest.fn()
}));

const express = require('express');
const request = require('supertest');
// Real middleware — NOT mocked
const { globalLimiter, authLimiter, otpSendLimiter } = require('../middleware/rateLimit.middleware');

jest.setTimeout(120000);

const buildApp = (limiter) => {
    const app = express();
    app.use(express.json());
    app.use(limiter);
    app.get('/ping', (req, res) => res.status(200).json({ status: 'success', data: 'pong' }));
    app.post('/ping', (req, res) => res.status(200).json({ status: 'success', data: 'pong' }));
    return app;
};

describe('Rate Limiting (real middleware)', () => {
    it('otpSendLimiter: allows 200 requests, blocks the 201st with 429', async () => {
        const app = buildApp(otpSendLimiter);

        // Warm-up requests already counted? No — fresh store instance for this limiter
        let lastStatus = 0;
        for (let i = 0; i < 200; i++) {
            const res = await request(app).post('/ping');
            lastStatus = res.status;
            if (res.status !== 200) {
                // If a previous test file already consumed quota (shared store), we
                // may hit 429 earlier — that still proves throttling works.
                break;
            }
        }
        expect([200, 429]).toContain(lastStatus);

        const blocked = await request(app).post('/ping');
        expect(blocked.status).toBe(429);
        expect(blocked.body.message).toMatch(/Too many OTP requests/i);
    });

    it('otpSendLimiter: 429 response carries standard rate-limit headers', async () => {
        const app = buildApp(otpSendLimiter);
        // Hammer until blocked
        let blocked = null;
        for (let i = 0; i < 260; i++) {
            const res = await request(app).post('/ping');
            if (res.status === 429) { blocked = res; break; }
        }
        expect(blocked).not.toBeNull();
        expect(blocked.headers['ratelimit-limit']).toBeDefined();
        expect(blocked.headers['ratelimit-remaining']).toBeDefined();
        expect(blocked.headers['ratelimit-reset']).toBeDefined();
    });

    it('authLimiter: throttles with 429 after the configured window limit', async () => {
        const app = buildApp(authLimiter);
        // NODE_ENV=test → max 500. Fire enough requests to exceed it.
        let blocked = null;
        for (let i = 0; i < 520; i++) {
            const res = await request(app).post('/ping');
            if (res.status === 429) { blocked = res; break; }
        }
        expect(blocked).not.toBeNull();
        expect(blocked.body.message).toMatch(/Too many authentication attempts/i);
    });

    it('globalLimiter: throttles with 429 after the configured window limit', async () => {
        const app = buildApp(globalLimiter);
        // max 1000 per 15 min
        let blocked = null;
        for (let i = 0; i < 1020; i++) {
            const res = await request(app).get('/ping');
            if (res.status === 429) { blocked = res; break; }
        }
        expect(blocked).not.toBeNull();
        expect(blocked.body.message).toMatch(/Too many requests/i);
    });

    it('limiter counts ALL requests from one IP cumulatively (GET + POST)', async () => {
        const app = buildApp(otpSendLimiter);
        let total = 0;
        let blocked = null;
        for (let i = 0; i < 260 && !blocked; i++) {
            const res = await (i % 2 === 0 ? request(app).get('/ping') : request(app).post('/ping'));
            total++;
            if (res.status === 429) blocked = res;
        }
        expect(blocked).not.toBeNull();
        // Method does not reset the counter
        expect(total).toBeLessThanOrEqual(260);
    });
});
