const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const Customer = require('../modules/customer/customer.model');
const catchAsync = require('../helpers/async.helper');
const { AUTH } = require('../constants/messages');
const { errorResponse } = require('../helpers/response.helper');
const { getCache, setCache } = require('../helpers/redis.helper');

const getJwtSecret = () => process.env.JWT_SECRET; // Read at call time (guaranteed by server.js startup check)

/**
 * @desc Authentication middleware — Redis-first session lookup
 * 1. Verify JWT signature
 * 2. Check token blacklist in Redis
 * 3. Load user from Redis session cache (cache-miss → DB fallback)
 */
const authMiddleware = catchAsync(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return errorResponse(res, AUTH.NOT_AUTHENTICATED, StatusCodes.UNAUTHORIZED);
    }

    let decoded;
    try {
        decoded = jwt.verify(token, getJwtSecret());
    } catch (error) {
        return errorResponse(res, AUTH.NOT_AUTHENTICATED, StatusCodes.UNAUTHORIZED);
    }

    // Check token blacklist (set by logout endpoint)
    const isBlacklisted = await getCache(`blacklist:${token}`);
    if (isBlacklisted) {
        return errorResponse(res, 'Token has been invalidated. Please log in again.', StatusCodes.UNAUTHORIZED);
    }

    // Try Redis session cache first — avoids DB query on every request
    const SESSION_KEY = `session:${decoded.id}`;
    const cachedSession = await getCache(SESSION_KEY);

    let user;
    if (cachedSession) {
        user = typeof cachedSession === 'string' ? JSON.parse(cachedSession) : cachedSession;
    } else {
        // Cache miss — fetch from DB and repopulate cache
        user = await Customer.findById(decoded.id).select('-password').lean();

        if (!user) {
            return errorResponse(res, AUTH.USER_NOT_FOUND, StatusCodes.UNAUTHORIZED);
        }

        // Re-cache for 24 hours
        await setCache(SESSION_KEY, JSON.stringify(user), 86400);
    }

    if (!user) {
        return errorResponse(res, AUTH.USER_NOT_FOUND, StatusCodes.UNAUTHORIZED);
    }

    // Attach additional worker-specific metadata
    if (user.role === 'WORKER') {
        req.isVerifiedWorker = user.isVerified && user.kyc?.status === 'APPROVED';
        req.walletBalance = user.wallet?.balance || 0;
    }

    req.user = user;
    next();
});

module.exports = { authMiddleware };
