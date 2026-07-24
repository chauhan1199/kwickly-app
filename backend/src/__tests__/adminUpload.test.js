const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

// Mock cloudinary service
jest.mock('../services/cloudinary.service', () => ({
    uploadImage: jest.fn().mockResolvedValue({
        url: 'https://res.cloudinary.com/test/image/upload/test.jpg',
        public_id: 'test_id'
    }),
    cleanupImage: jest.fn()
}));

// Mock upload middleware to simulate file upload via multer memoryStorage
jest.mock('../middleware/upload.middleware', () => {
    const multer = require('multer');
    return multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 }
    });
});

const { uploadImage } = require('../services/cloudinary.service');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);

describe('Admin Upload', () => {
    let adminToken, customerToken;
    let seq = 0;

    beforeEach(async () => {
        await clearCollections();
        jest.clearAllMocks();
        seq++;
        const admin = await createTestUser({ role: 'ADMIN', email: `uploadadmin${seq}@test.com`, phone: `810000${String(seq).padStart(4, '0')}` });
        adminToken = generateToken(admin);

        const customer = await createTestUser({ role: 'CUSTOMER', email: `uploadcust${seq}@test.com`, phone: `820000${String(seq).padStart(4, '0')}` });
        customerToken = generateToken(customer);
    });

    describe('POST /api/v1/admin/upload-image', () => {
        it('should upload a valid image file', async () => {
            const res = await request(app)
                .post('/api/v1/admin/upload-image')
                .set('Authorization', `Bearer ${adminToken}`)
                .attach('image', Buffer.from('fake image data'), {
                    filename: 'test.jpg',
                    contentType: 'image/jpeg'
                });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.url).toContain('cloudinary.com');
            expect(uploadImage).toHaveBeenCalled();
        });

        it('should reject request without file', async () => {
            const res = await request(app)
                .post('/api/v1/admin/upload-image')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/no file uploaded/i);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/admin/upload-image')
                .attach('image', Buffer.from('fake image data'), {
                    filename: 'test.jpg',
                    contentType: 'image/jpeg'
                });

            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .post('/api/v1/admin/upload-image')
                .set('Authorization', `Bearer ${customerToken}`)
                .attach('image', Buffer.from('fake image data'), {
                    filename: 'test.jpg',
                    contentType: 'image/jpeg'
                });

            expect(res.status).toBe(403);
        });
    });
});
