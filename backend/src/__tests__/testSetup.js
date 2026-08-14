const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

let mongoServer;

// Mock Redis for all tests
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

// Mock rate limiter - pass through all requests
jest.mock('../middleware/rateLimit.middleware', () => {
    const passThrough = (req, res, next) => next();
    return {
        globalLimiter: passThrough,
        authLimiter: passThrough,
        otpSendLimiter: passThrough
    };
});

// Mock Socket helper
jest.mock('../helpers/socket.helper', () => ({
    initSocket: jest.fn(),
    getIO: jest.fn(),
    emitToAll: jest.fn(),
    emitToRoom: jest.fn(),
    triggerDashboardUpdate: jest.fn(),
    emitToUser: jest.fn()
}));

// Mock SMS service
jest.mock('../services/sms.service', () => ({
    sendOTP: jest.fn().mockResolvedValue('1234')
}));

const setup = async () => {
    process.env.JWT_SECRET = 'test_secret_key';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.NODE_ENV = 'test';

    mongoServer = await MongoMemoryServer.create({
        instance: {
            port: 27018,
            dbName: 'kwickly_test',
            launchTimeout: 60000
        },
        binary: {
            downloadTimeout: 120
        }
    });
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000
    });
};

const teardown = async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
};

const clearCollections = async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
};

const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );
};

const createTestUser = async (overrides = {}) => {
    const Customer = require('../modules/customer/customer.model');
    const hashedPassword = await bcrypt.hash('password123', 12);
    const userData = {
        name: 'Test User',
        phone: '9876543210',
        email: 'test@example.com',
        role: 'CUSTOMER',
        password: hashedPassword,
        isVerified: true,
        ...overrides
    };
    return Customer.create(userData);
};

// Prevent Jest from treating this as a test suite
describe('setup', () => {
    it('placeholder', () => { });
});

// Increase default timeout for MongoDB binary download
jest.setTimeout(120000);

module.exports = { setup, teardown, clearCollections, generateToken, createTestUser };