const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Message = require('../modules/chat/message.model');

// Mock Cloudinary service
jest.mock('../services/cloudinary.service', () => ({
    uploadImage: jest.fn().mockResolvedValue({ url: 'https://res.cloudinary.com/test/image/upload/test.jpg', public_id: 'test_id' }),
    uploadBase64: jest.fn().mockResolvedValue({ url: 'https://res.cloudinary.com/test/image/upload/test_b64.jpg', public_id: 'test_b64_id' }),
    cleanupImage: jest.fn()
}));

// Mock upload middleware to simulate file upload
jest.mock('../middleware/upload.middleware', () => {
    const multer = require('multer');
    return multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 }
    });
});

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Chat Routes — Extended', () => {
    let customerToken, workerToken, adminToken;

    beforeEach(async () => {
        const customer = await createTestUser({ role: 'CUSTOMER', email: 'chatextc@test.com', phone: '1234567890' });
        customerToken = generateToken(customer);

        const worker = await createTestUser({ role: 'WORKER', email: 'chatextw@test.com', phone: '1234567891' });
        workerToken = generateToken(worker);

        const admin = await createTestUser({ role: 'ADMIN', email: 'chatextadmin@test.com', phone: '1234567892' });
        adminToken = generateToken(admin);
    });

    describe('POST /api/v1/chat/mark-read', () => {
        it('should mark messages as read for a customer', async () => {
            // Seed some unread messages from admin (senderId: null) to customer
            await Message.create([
                { senderId: null, receiverId: customerToken.id ? undefined : '507f1f77bcf86cd799439011', text: 'Support reply 1', isRead: false },
                { senderId: null, receiverId: customerToken.id ? undefined : '507f1f77bcf86cd799439011', text: 'Support reply 2', isRead: false }
            ]);

            const res = await request(app)
                .post('/api/v1/chat/mark-read')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
        });

        it('should mark messages as read for admin with partnerId', async () => {
            const res = await request(app)
                .post('/api/v1/chat/mark-read')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ partnerId: '507f1f77bcf86cd799439011' });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/chat/mark-read')
                .send({});
            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/v1/chat/support/threads', () => {
        it('should return support threads for admin', async () => {
            // Seed a support message
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'threadc@test.com', phone: '1234560001' });
            await Message.create({
                senderId: customer._id,
                receiverId: null,
                text: 'Help me with my order',
                isRead: false
            });

            const res = await request(app)
                .get('/api/v1/chat/support/threads')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .get('/api/v1/chat/support/threads')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(403);
        });

        it('should reject worker from accessing support threads', async () => {
            const res = await request(app)
                .get('/api/v1/chat/support/threads')
                .set('Authorization', `Bearer ${workerToken}`);

            expect(res.status).toBe(403);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .get('/api/v1/chat/support/threads');

            expect(res.status).toBe(401);
        });

        it('should return empty array when no support threads exist', async () => {
            const res = await request(app)
                .get('/api/v1/chat/support/threads')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });
    });

    describe('POST /api/v1/chat/upload-image', () => {
        it('should upload an image and return URL', async () => {
            const res = await request(app)
                .post('/api/v1/chat/upload-image')
                .set('Authorization', `Bearer ${customerToken}`)
                .attach('image', Buffer.from('fake image data'), { filename: 'test.jpg', contentType: 'image/jpeg' });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.url).toContain('cloudinary.com');
        });

        it('should reject request without file', async () => {
            const res = await request(app)
                .post('/api/v1/chat/upload-image')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(400);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/chat/upload-image');

            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/v1/chat/upload-base64', () => {
        it('should upload a base64 image and return URL', async () => {
            const res = await request(app)
                .post('/api/v1/chat/upload-base64')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.url).toContain('cloudinary.com');
        });

        it('should reject request without base64 data', async () => {
            const res = await request(app)
                .post('/api/v1/chat/upload-base64')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/no base64 data/i);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/chat/upload-base64')
                .send({ base64: 'data:image/png;base64,abc123' });

            expect(res.status).toBe(401);
        });
    });
});
