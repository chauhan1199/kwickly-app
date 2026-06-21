/**
 * Rate Limiting Middleware — Kwickly
 * Provides centralized rate limit configurations for different route types.
 * Uses in-memory store by default; swap to a Redis store for multi-instance deployments.
 */

const rateLimit = require('express-rate-limit');

/**
 * @desc Global limiter — applies to all routes
 * 100 requests per 15 minutes per IP
 */
const globalLimiter = rateLimit({
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
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many authentication attempts. Please wait 15 minutes.' }
});

/**
 * @desc OTP send limiter — very strict
 * 3 OTP sends per 10 minutes per IP
 */
const otpSendLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many OTP requests. Please wait 10 minutes.' }
});

module.exports = { globalLimiter, authLimiter, otpSendLimiter };
