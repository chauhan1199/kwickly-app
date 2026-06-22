// Mock Redis for all tests
jest.mock('./helpers/redis.helper', () => ({
    initRedis: jest.fn(),
    getRedis: jest.fn().mockReturnValue({
        incr: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1),
        set: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue(null),
        del: jest.fn().mockResolvedValue(1),
        keys: jest.fn().mockResolvedValue([]),
    }),
    setCache: jest.fn().mockResolvedValue('OK'),
    getCache: jest.fn().mockResolvedValue(null),
    delCache: jest.fn().mockResolvedValue(1)
}));

// Mock rate limiter - pass through all requests
jest.mock('./middleware/rateLimit.middleware', () => {
    const passThrough = (req, res, next) => next();
    return {
        globalLimiter: passThrough,
        authLimiter: passThrough,
        otpSendLimiter: passThrough
    };
});

// Mock Socket helper
jest.mock('./helpers/socket.helper', () => ({
    initSocket: jest.fn(),
    getIO: jest.fn(),
    emitToAll: jest.fn(),
    emitToRoom: jest.fn(),
    triggerDashboardUpdate: jest.fn(),
    emitToUser: jest.fn()
}));

// Mock SMS service
jest.mock('./services/sms.service', () => ({
    sendOTP: jest.fn().mockResolvedValue('1234')
}));
