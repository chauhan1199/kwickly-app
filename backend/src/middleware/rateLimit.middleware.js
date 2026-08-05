/**
 * Rate Limiting Middleware — Kwickly
 * Provides centralized rate limit configurations for different route types.
 * Migrated to RedisStore to support multi-instance Kubernetes deployments.
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default || require('rate-limit-redis');
const { getRedis } = require('../helpers/redis.helper');

/**
 * Adaptive rate-limit store.
 *
 * Uses the RedisStore when a Redis client is available (multi-instance support)
 * and transparently degrades to an in-memory store when Redis is unavailable or
 * errors at request time. Previously, rate-limit-redis crashed with
 * "unexpected reply from redis client" whenever the Redis client was missing or
 * unreachable, turning a rate-limit outage into a 500 on every request (H17).
 */
class AdaptiveRateLimitStore {
    constructor() {
        this.options = null;
        this.redisStore = null;
        this.redisInitPromise = null;
        this.memoryStore = null;
        // Each limiter owns a dedicated store instance, so keys are local to it.
        // Lets express-rate-limit distinguish limiters in its single-count
        // validation (avoids false ERR_ERL_DOUBLE_COUNT when global + auth
        // limiters both process the same request).
        this.localKeys = true;
    }

    init(options) {
        this.options = options;
        this.memoryStore = new rateLimit.MemoryStore();
        this.memoryStore.init(options);
    }

    async ensureRedis() {
        if (this.redisStore || !this.options || !this.memoryStore) {
            return !!this.redisStore;
        }
        const client = getRedis();
        if (!client || client.status !== 'ready') {
            return false;
        }
        if (!this.redisInitPromise) {
            const store = new RedisStore({
                sendCommand: (...args) => {
                    const c = getRedis();
                    if (!c || c.status !== 'ready') {
                        return Promise.resolve(null);
                    }
                    return c.call(...args).catch(() => Promise.resolve(null));
                },
            });
            this.redisStore = store;
            this.redisInitPromise = Promise.resolve()
                .then(() => store.init(this.options))
                .catch(() => {
                    // Redis init failed — fall back to in-memory store
                    this.redisStore = null;
                });
        }
        await this.redisInitPromise;
        return !!this.redisStore;
    }

    async increment(key) {
        if (await this.ensureRedis()) {
            try {
                return await this.redisStore.increment(key);
            } catch (error) {
                // Redis errored mid-request — degrade to in-memory store
                this.redisStore = null;
                this.redisInitPromise = null;
            }
        }
        return this.memoryStore.increment(key);
    }

    async decrement(key) {
        if (await this.ensureRedis()) {
            try {
                return await this.redisStore.decrement(key);
            } catch (error) {
                this.redisStore = null;
                this.redisInitPromise = null;
            }
        }
        return this.memoryStore.decrement(key);
    }

    async resetKey(key) {
        if (await this.ensureRedis()) {
            try {
                return await this.redisStore.resetKey(key);
            } catch (error) {
                this.redisStore = null;
                this.redisInitPromise = null;
            }
        }
        return this.memoryStore.resetKey(key);
    }

    async resetAll() {
        if (await this.ensureRedis()) {
            try {
                return await this.redisStore.resetAll();
            } catch (error) {
                this.redisStore = null;
                this.redisInitPromise = null;
            }
        }
        return this.memoryStore.resetAll();
    }
}

const getStore = () => {
    return new AdaptiveRateLimitStore();
};

/**
 * @desc Global limiter — applies to all routes
 * 1000 requests per 15 minutes per IP
 */
const globalLimiter = rateLimit({
    store: getStore(),
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many requests. Please try again later.' }
});

/**
 * @desc Strict limiter — applies to auth routes (OTP send/verify, login)
 * 5 requests per 15 minutes per IP
 */
const authLimiter = rateLimit({
    store: getStore(),
    windowMs: 15 * 60 * 1000,
    max: (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') ? 500 : 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many authentication attempts. Please wait 15 minutes.' }
});

/**
 * @desc OTP send limiter — very strict
 * 3 OTP sends per 10 minutes per IP
 */
const otpSendLimiter = rateLimit({
    store: getStore(),
    windowMs: 10 * 60 * 1000,
    max: (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') ? 300 : 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many OTP requests. Please wait 10 minutes.' }
});

module.exports = { globalLimiter, authLimiter, otpSendLimiter };
