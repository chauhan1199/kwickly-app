/**
 * A user restored from the Redis session cache has string ids (JSON). The auth
 * middleware must hand controllers a real ObjectId so aggregate $match works.
 */
const mongoose = require('mongoose');

const mockCachedUser = { _id: new mongoose.Types.ObjectId().toString(), role: 'WORKER', name: 'Cached' };

jest.mock('../helpers/redis.helper', () => ({
    getCache: jest.fn(async (key) => (key.startsWith('session:') ? JSON.stringify(mockCachedUser) : null)),
    setCache: jest.fn(async () => true),
    delCache: jest.fn(async () => true),
}));

const jwt = require('jsonwebtoken');
const { authMiddleware } = require('../middleware/auth.middleware');

describe('auth middleware with a cached session', () => {
    it('restores req.user._id to an ObjectId', async () => {
        process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
        const token = jwt.sign({ id: mockCachedUser._id }, process.env.JWT_SECRET);
        const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();
        await new Promise((resolve) => {
            next.mockImplementation(resolve);
            res.json.mockImplementation(resolve);
            authMiddleware(req, res, next);
        });

        expect(next).toHaveBeenCalled();
        expect(req.user._id).toBeInstanceOf(mongoose.Types.ObjectId);
        expect(String(req.user._id)).toBe(mockCachedUser._id);
    });
});
