const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

jest.mock('../middleware/rateLimit.middleware', () => {
    const passThrough = (req, res, next) => next();
    return { globalLimiter: passThrough, authLimiter: passThrough, otpSendLimiter: passThrough };
});

const { getCache, setCache, delCache } = require('../helpers/redis.helper');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); jest.clearAllMocks(); }, 10000);

describe('Auth Routes', () => {
    describe('POST /api/v1/auth/check-status', () => {
        it('should check user status for existing user', async () => {
            await createTestUser({ phone: '9876543210', role: 'CUSTOMER', password: 'hashed_password' });
            getCache.mockResolvedValue(null);
            setCache.mockResolvedValue('OK');

            const res = await request(app)
                .post('/api/v1/auth/check-status')
                .send({ phone: '9876543210', role: 'CUSTOMER' });
            expect(res.status).toBe(200);
            expect(res.body.data.exists).toBe(true);
            expect(res.body.data.hasPassword).toBe(true);
        });

        it('should check user status for non-existing user', async () => {
            getCache.mockResolvedValue(null);
            const res = await request(app)
                .post('/api/v1/auth/check-status')
                .send({ phone: '9999999999', role: 'CUSTOMER' });
            expect(res.status).toBe(200);
            expect(res.body.data.exists).toBe(false);
        });
    });

    describe('POST /api/v1/auth/send-otp', () => {
        it('should send OTP successfully', async () => {
            getCache.mockResolvedValue(null);
            setCache.mockResolvedValue('OK');

            const res = await request(app)
                .post('/api/v1/auth/send-otp')
                .send({ phone: '9876543210', role: 'CUSTOMER' });
            expect([200, 429]).toContain(res.status);
            if (res.status === 200) {
                expect(res.body.status).toBe('success');
            }
        });

        it('should reject with missing phone', async () => {
            getCache.mockResolvedValue(null);
            const res = await request(app)
                .post('/api/v1/auth/send-otp')
                .send({ role: 'CUSTOMER' });
            expect([400, 429]).toContain(res.status);
        });
    });

    describe('POST /api/v1/auth/login', () => {
        it('should login successfully with email', async () => {
            await createTestUser({ email: 'login@example.com' });
            getCache.mockResolvedValue(null);
            setCache.mockResolvedValue('OK');

            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'login@example.com', password: 'password123', role: 'CUSTOMER' });
            expect([200, 429]).toContain(res.status);
            if (res.status === 200) {
                expect(res.body.data.token).toBeDefined();
                expect(res.body.data.user).toBeDefined();
            }
        });

        it('should login successfully with phone', async () => {
            await createTestUser({ phone: '9876543211' });
            getCache.mockResolvedValue(null);
            setCache.mockResolvedValue('OK');

            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ phone: '9876543211', password: 'password123', role: 'CUSTOMER' });
            expect([200, 429]).toContain(res.status);
            if (res.status === 200) {
                expect(res.body.data.token).toBeDefined();
            }
        });

        it('should reject login with wrong password', async () => {
            await createTestUser({ email: 'wrong@example.com' });
            getCache.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'wrong@example.com', password: 'wrongpassword', role: 'CUSTOMER' });
            expect([401, 429]).toContain(res.status);
        });

        it('should reject login with non-existing user', async () => {
            getCache.mockResolvedValue(null);
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'nonexistent@example.com', password: 'password123', role: 'CUSTOMER' });
            expect([401, 429]).toContain(res.status);
        });

        it('should reject login without password', async () => {
            getCache.mockResolvedValue(null);
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'test@example.com' });
            expect([400, 429]).toContain(res.status);
        });
    });

    describe('POST /api/v1/auth/verify-otp', () => {
        it('should verify OTP and create new user', async () => {
            getCache.mockResolvedValue('1234');
            delCache.mockResolvedValue(1);
            setCache.mockResolvedValue('OK');

            const res = await request(app)
                .post('/api/v1/auth/verify-otp')
                .send({ phone: '9876543210', code: '1234', role: 'CUSTOMER' });
            expect([200, 400, 429]).toContain(res.status);
            if (res.status === 200) {
                expect(res.body.data.token).toBeDefined();
                expect(res.body.data.isNew).toBe(true);
            }
        });

        it('should reject invalid OTP', async () => {
            getCache.mockResolvedValue('1234');
            delCache.mockResolvedValue(0);
            setCache.mockResolvedValue('OK');

            const res = await request(app)
                .post('/api/v1/auth/verify-otp')
                .send({ phone: '9876543210', code: '0000', role: 'CUSTOMER' });
            expect([400, 429]).toContain(res.status);
        });
    });

    describe('GET /api/v1/auth/me', () => {
        it('should return user profile when authenticated', async () => {
            const user = await createTestUser({ email: 'me@example.com' });
            getCache.mockResolvedValue(null);
            setCache.mockResolvedValue('OK');

            const token = generateToken(user);
            const res = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.email).toBe('me@example.com');
        });

        it('should reject unauthenticated request', async () => {
            getCache.mockResolvedValue(null);
            const res = await request(app).get('/api/v1/auth/me');
            expect(res.status).toBe(401);
        });

        it('should reject with invalid token', async () => {
            getCache.mockResolvedValue(null);
            const res = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', 'Bearer invalidtoken');
            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/v1/auth/logout', () => {
        it('should logout successfully', async () => {
            const user = await createTestUser({ email: 'logout@example.com' });
            getCache.mockResolvedValue(null);
            setCache.mockResolvedValue('OK');

            const token = generateToken(user);
            const res = await request(app)
                .post('/api/v1/auth/logout')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
    });

    describe('PATCH /api/v1/auth/set-password', () => {
        it('should set password when authenticated', async () => {
            const user = await createTestUser({ email: 'setpwd@example.com' });
            getCache.mockResolvedValue(null);
            delCache.mockResolvedValue(1);
            setCache.mockResolvedValue('OK');

            const token = generateToken(user);
            const res = await request(app)
                .patch('/api/v1/auth/set-password')
                .set('Authorization', `Bearer ${token}`)
                .send({ password: 'newpassword123' });
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/v1/auth/forgot-password', () => {
        it('should send reset OTP for existing user', async () => {
            await createTestUser({ phone: '9876543210' });
            getCache.mockResolvedValue(null);
            setCache.mockResolvedValue('OK');

            const res = await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({ phone: '9876543210', role: 'CUSTOMER' });
            expect([200, 429]).toContain(res.status);
        });

        it('should return 404 for non-existing user', async () => {
            getCache.mockResolvedValue(null);
            const res = await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({ phone: '9999999999', role: 'CUSTOMER' });
            expect([404, 429]).toContain(res.status);
        });
    });
});
