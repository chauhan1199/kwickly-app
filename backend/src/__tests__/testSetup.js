const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

let mongoServer;


const setup = async () => {
    process.env.JWT_SECRET = 'test_secret_key';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.NODE_ENV = 'test';

    mongoServer = await MongoMemoryServer.create({
        instance: { port: 27018 }
    });
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
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
    it('placeholder', () => {});
});

module.exports = { setup, teardown, clearCollections, generateToken, createTestUser };
