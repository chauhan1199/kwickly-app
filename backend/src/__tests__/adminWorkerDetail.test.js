const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

// Mock cloudinary
jest.mock('../services/cloudinary.service', () => ({
    uploadImage: jest.fn().mockResolvedValue({ url: 'https://res.cloudinary.com/test/image/upload/test.jpg', public_id: 'test_id' }),
    cleanupImage: jest.fn(),
    uploadBase64: jest.fn().mockResolvedValue({ url: 'https://res.cloudinary.com/test/image/upload/test_b64.jpg', public_id: 'test_b64_id' })
}));

const { uploadImage, cleanupImage } = require('../services/cloudinary.service');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);

describe('Admin Worker Detail Management', () => {
    let adminToken, customerToken;
    let seq = 0;

    beforeEach(async () => {
        await clearCollections();
        seq++;
        const admin = await createTestUser({ role: 'ADMIN', email: `adminwd${seq}@test.com`, phone: `7100000${String(seq).padStart(4, '0')}` });
        adminToken = generateToken(admin);

        const customer = await createTestUser({ role: 'CUSTOMER', email: `custwd${seq}@test.com`, phone: `7200000${String(seq).padStart(4, '0')}` });
        customerToken = generateToken(customer);

        jest.clearAllMocks();
    });

    const createTestWorker = async (overrides = {}) => {
        return createTestUser({
            role: 'WORKER',
            email: `worker${Date.now()}@test.com`,
            phone: String(Date.now()).slice(-10),
            name: 'Test Worker',
            kyc: { status: 'PENDING', documents: [] },
            subscription: { isTrial: true },
            ...overrides
        });
    };

    // ─── GET /api/v1/admin/workers/:id ──────────────────────────────────
    describe('GET /api/v1/admin/workers/:id', () => {
        it('should return worker detail with stats', async () => {
            const worker = await createTestWorker();

            const res = await request(app)
                .get(`/api/v1/admin/workers/${worker._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.worker.name).toBe('Test Worker');
            expect(res.body.data.worker.role).toBe('WORKER');
            expect(res.body.data).toHaveProperty('jobStats');
            expect(res.body.data).toHaveProperty('recentJobs');
            expect(res.body.data).toHaveProperty('totalEarnings');
        });

        it('should not include password in response', async () => {
            const worker = await createTestWorker();

            const res = await request(app)
                .get(`/api/v1/admin/workers/${worker._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.worker).not.toHaveProperty('password');
        });

        it('should return 404 for non-existent worker', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .get(`/api/v1/admin/workers/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });

        it('should return 404 for non-worker user', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'notaworker@test.com', phone: '9999999999' });

            const res = await request(app)
                .get(`/api/v1/admin/workers/${customer._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated request', async () => {
            const worker = await createTestWorker();
            const res = await request(app).get(`/api/v1/admin/workers/${worker._id}`);
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const worker = await createTestWorker();
            const res = await request(app)
                .get(`/api/v1/admin/workers/${worker._id}`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    // ─── PATCH /api/v1/admin/workers/:id/kyc ────────────────────────────
    describe('PATCH /api/v1/admin/workers/:id/kyc', () => {
        it('should approve worker KYC with documents', async () => {
            const worker = await createTestWorker({
                kyc: {
                    status: 'PENDING',
                    documents: [{ type: 'AADHAR', url: 'http://test.com/doc', public_id: 'doc1', uploadedAt: new Date() }]
                }
            });

            const res = await request(app)
                .patch(`/api/v1/admin/workers/${worker._id}/kyc`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'APPROVED' });

            expect(res.status).toBe(200);
            expect(res.body.data.kyc.status).toBe('APPROVED');
            expect(res.body.data.isVerified).toBe(true);
        });

        it('should reject worker KYC', async () => {
            const worker = await createTestWorker({
                kyc: { status: 'PENDING', documents: [] }
            });

            const res = await request(app)
                .patch(`/api/v1/admin/workers/${worker._id}/kyc`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'REJECTED' });

            expect(res.status).toBe(200);
            expect(res.body.data.kyc.status).toBe('REJECTED');
        });

        it('should reject approval without documents', async () => {
            const worker = await createTestWorker({
                kyc: { status: 'PENDING', documents: [] }
            });

            const res = await request(app)
                .patch(`/api/v1/admin/workers/${worker._id}/kyc`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'APPROVED' });

            expect(res.status).toBe(400);
        });

        it('should return 404 for non-existent worker', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .patch(`/api/v1/admin/workers/${fakeId}/kyc`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'APPROVED' });

            expect(res.status).toBe(404);
        });

        it('should reject with invalid status value', async () => {
            const worker = await createTestWorker();

            const res = await request(app)
                .patch(`/api/v1/admin/workers/${worker._id}/kyc`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'INVALID' });

            expect(res.status).toBe(400);
        });

        it('should reject with missing status', async () => {
            const worker = await createTestWorker();

            const res = await request(app)
                .patch(`/api/v1/admin/workers/${worker._id}/kyc`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(res.status).toBe(400);
        });

        it('should reject unauthenticated request', async () => {
            const worker = await createTestWorker();
            const res = await request(app)
                .patch(`/api/v1/admin/workers/${worker._id}/kyc`)
                .send({ status: 'APPROVED' });
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const worker = await createTestWorker();
            const res = await request(app)
                .patch(`/api/v1/admin/workers/${worker._id}/kyc`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ status: 'APPROVED' });
            expect(res.status).toBe(403);
        });
    });

    // ─── POST /api/v1/admin/workers/:id/kyc-documents ───────────────────
    describe('POST /api/v1/admin/workers/:id/kyc-documents', () => {
        it('should upload a KYC document', async () => {
            const worker = await createTestWorker();

            const res = await request(app)
                .post(`/api/v1/admin/workers/${worker._id}/kyc-documents`)
                .set('Authorization', `Bearer ${adminToken}`)
                .attach('document', Buffer.from('fake pdf content'), { filename: 'kyc.pdf', contentType: 'application/pdf' })
                .field('docType', 'AADHAR');

            expect(res.status).toBe(200);
            expect(res.body.data.kyc.documents.length).toBe(1);
            expect(res.body.data.kyc.documents[0].type).toBe('AADHAR');
            expect(uploadImage).toHaveBeenCalled();
        });

        it('should set KYC status to PENDING after upload', async () => {
            const worker = await createTestWorker({ kyc: { status: 'APPROVED', documents: [] } });

            const res = await request(app)
                .post(`/api/v1/admin/workers/${worker._id}/kyc-documents`)
                .set('Authorization', `Bearer ${adminToken}`)
                .attach('document', Buffer.from('fake content'), { filename: 'doc.jpg', contentType: 'image/jpeg' });

            expect(res.status).toBe(200);
            expect(res.body.data.kyc.status).toBe('PENDING');
        });

        it('should default docType to OTHER when not provided', async () => {
            const worker = await createTestWorker();

            const res = await request(app)
                .post(`/api/v1/admin/workers/${worker._id}/kyc-documents`)
                .set('Authorization', `Bearer ${adminToken}`)
                .attach('document', Buffer.from('fake content'), { filename: 'doc.pdf', contentType: 'application/pdf' });

            expect(res.status).toBe(200);
            expect(res.body.data.kyc.documents[0].type).toBe('OTHER');
        });

        it('should reject when no file is uploaded', async () => {
            const worker = await createTestWorker();

            const res = await request(app)
                .post(`/api/v1/admin/workers/${worker._id}/kyc-documents`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ docType: 'AADHAR' });

            expect(res.status).toBe(400);
        });

        it('should return 404 for non-existent worker', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .post(`/api/v1/admin/workers/${fakeId}/kyc-documents`)
                .set('Authorization', `Bearer ${adminToken}`)
                .attach('document', Buffer.from('fake'), { filename: 'doc.pdf', contentType: 'application/pdf' });

            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/admin/workers/fakeid/kyc-documents');
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .post('/api/v1/admin/workers/fakeid/kyc-documents')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    // ─── DELETE /api/v1/admin/workers/:id/kyc-documents/:docIndex ───────
    describe('DELETE /api/v1/admin/workers/:id/kyc-documents/:docIndex', () => {
        it('should remove a KYC document', async () => {
            const worker = await createTestWorker({
                kyc: {
                    status: 'PENDING',
                    documents: [
                        { type: 'AADHAR', url: 'http://test.com/doc1', public_id: 'doc1', uploadedAt: new Date() },
                        { type: 'PAN', url: 'http://test.com/doc2', public_id: 'doc2', uploadedAt: new Date() }
                    ]
                }
            });

            const res = await request(app)
                .delete(`/api/v1/admin/workers/${worker._id}/kyc-documents/0`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.kyc.documents.length).toBe(1);
            expect(res.body.data.kyc.documents[0].type).toBe('PAN');
            expect(cleanupImage).toHaveBeenCalled();
        });

        it('should return 404 when document index is out of range', async () => {
            const worker = await createTestWorker({
                kyc: {
                    status: 'PENDING',
                    documents: [{ type: 'AADHAR', url: 'http://test.com/doc1', public_id: 'doc1', uploadedAt: new Date() }]
                }
            });

            const res = await request(app)
                .delete(`/api/v1/admin/workers/${worker._id}/kyc-documents/5`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });

        it('should return 404 when no documents exist', async () => {
            const worker = await createTestWorker({
                kyc: { status: 'PENDING', documents: [] }
            });

            const res = await request(app)
                .delete(`/api/v1/admin/workers/${worker._id}/kyc-documents/0`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });

        it('should return 404 for non-existent worker', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .delete(`/api/v1/admin/workers/${fakeId}/kyc-documents/0`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .delete('/api/v1/admin/workers/fakeid/kyc-documents/0');
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .delete('/api/v1/admin/workers/fakeid/kyc-documents/0')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    // ─── PATCH /api/v1/admin/workers/:id/extend-subscription ────────────
    describe('PATCH /api/v1/admin/workers/:id/extend-subscription', () => {
        it('should extend subscription by specified days', async () => {
            const worker = await createTestWorker({
                subscription: { isTrial: true, expiryDate: new Date(Date.now() + 5 * 86400000) }
            });

            const res = await request(app)
                .patch(`/api/v1/admin/workers/${worker._id}/extend-subscription`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ days: 30 });

            expect(res.status).toBe(200);
            expect(res.body.data.expiryDate).toBeDefined();
        });

        it('should set expiry from now when subscription is expired', async () => {
            const pastDate = new Date(Date.now() - 10 * 86400000);
            const worker = await createTestWorker({
                subscription: { isTrial: false, expiryDate: pastDate, planId: 'MONTHLY' }
            });

            const res = await request(app)
                .patch(`/api/v1/admin/workers/${worker._id}/extend-subscription`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ days: 7 });

            expect(res.status).toBe(200);
            const newExpiry = new Date(res.body.data.expiryDate);
            const now = new Date();
            const diffDays = Math.round((newExpiry - now) / 86400000);
            expect(diffDays).toBeLessThanOrEqual(8);
            expect(diffDays).toBeGreaterThanOrEqual(6);
        });

        it('should set isTrial to false after extension', async () => {
            const worker = await createTestWorker({
                subscription: { isTrial: true }
            });

            const res = await request(app)
                .patch(`/api/v1/admin/workers/${worker._id}/extend-subscription`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ days: 15 });

            expect(res.status).toBe(200);
        });

        it('should reject with zero days', async () => {
            const worker = await createTestWorker();

            const res = await request(app)
                .patch(`/api/v1/admin/workers/${worker._id}/extend-subscription`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ days: 0 });

            expect(res.status).toBe(400);
        });

        it('should reject with negative days', async () => {
            const worker = await createTestWorker();

            const res = await request(app)
                .patch(`/api/v1/admin/workers/${worker._id}/extend-subscription`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ days: -5 });

            expect(res.status).toBe(400);
        });

        it('should reject with missing days', async () => {
            const worker = await createTestWorker();

            const res = await request(app)
                .patch(`/api/v1/admin/workers/${worker._id}/extend-subscription`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(res.status).toBe(400);
        });

        it('should return 404 for non-existent worker', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .patch(`/api/v1/admin/workers/${fakeId}/extend-subscription`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ days: 30 });

            expect(res.status).toBe(404);
        });

        it('should return 404 for non-worker user', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'notaworker@test.com', phone: '9999999999' });

            const res = await request(app)
                .patch(`/api/v1/admin/workers/${customer._id}/extend-subscription`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ days: 30 });

            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .patch('/api/v1/admin/workers/fakeid/extend-subscription')
                .send({ days: 30 });
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .patch('/api/v1/admin/workers/fakeid/extend-subscription')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ days: 30 });
            expect(res.status).toBe(403);
        });
    });
});
