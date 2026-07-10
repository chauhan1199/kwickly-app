/**
 * Rate Limiting Middleware — Kwickly
 * Provides centralized rate limit configurations for different route types.
 * Migrated to RedisStore to support multi-instance Kubernetes deployments.
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default || require('rate-limit-redis');
const { getRedis } = require('../helpers/redis.helper');

const getStore = () => {
    return new RedisStore({
        sendCommand: (...args) => {
            const client = getRedis();
            if (client) return client.call(...args);
            // Fallback if Redis is down
            return Promise.reject(new Error('Redis client unavailable'));
        },
    });
};

/**
 * @desc Global limiter — applies to all routes
 * 100 requests per 15 minutes per IP
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
