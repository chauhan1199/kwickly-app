const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Suggestion = require('../modules/suggestion/suggestion.model');
const Category = require('../modules/category/category.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);

describe('Admin Suggestion Endpoints — Extended', () => {
    let adminToken, customerToken, workerToken;
    let worker;
    let seq = 0;

    beforeEach(async () => {
        await clearCollections();
        jest.clearAllMocks();
        seq++;

        const admin = await createTestUser({ role: 'ADMIN', email: `sugadmin${seq}@test.com`, phone: `810000${String(seq).padStart(4, '0')}` });
        adminToken = generateToken(admin);

        const customer = await createTestUser({ role: 'CUSTOMER', email: `sugcust${seq}@test.com`, phone: `820000${String(seq).padStart(4, '0')}` });
        customerToken = generateToken(customer);

        worker = await createTestUser({ role: 'WORKER', email: `sugworker${seq}@test.com`, phone: `830000${String(seq).padStart(4, '0')}` });
        workerToken = generateToken(worker);
    });

    describe('GET /api/v1/admin/suggestions', () => {
        it('should list all suggestions', async () => {
            await Suggestion.create({
                workerId: worker._id,
                type: 'new_category',
                payload: { name: 'Cleaning', description: 'Home cleaning services', icon: '🧹' },
                status: 'pending'
            });

            const res = await request(app)
                .get('/api/v1/admin/suggestions')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        });

        it('should return suggestions list (empty or populated)', async () => {
            const res = await request(app)
                .get('/api/v1/admin/suggestions')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should require admin authentication', async () => {
            const res = await request(app).get('/api/v1/admin/suggestions');
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .get('/api/v1/admin/suggestions')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(403);
        });
    });

    describe('PATCH /api/v1/admin/suggestions/:id/approve', () => {
        it('should approve a new_category suggestion and create the category', async () => {
            const suggestion = await Suggestion.create({
                workerId: worker._id,
                type: 'new_category',
                payload: { name: 'Painting', description: 'Interior and exterior painting', icon: '🎨', suggestedSubcategories: ['Interior', 'Exterior'] },
                status: 'pending',
                source: 'worker'
            });

            const res = await request(app)
                .patch(`/api/v1/admin/suggestions/${suggestion._id}/approve`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ reason: 'Good idea, adding this category' });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('approved');

            const cat = await Category.findOne({ name: 'Painting' });
            expect(cat).toBeTruthy();
            expect(cat.icon).toBe('🎨');
            expect(cat.subcategories.length).toBe(2);
        });

        it('should return 400 when reason is missing', async () => {
            const suggestion = await Suggestion.create({
                workerId: worker._id,
                type: 'new_category',
                payload: { name: 'Gardening', description: 'Garden services' },
                status: 'pending'
            });

            const res = await request(app)
                .patch(`/api/v1/admin/suggestions/${suggestion._id}/approve`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(res.status).toBe(400);
        });

        it('should return 404 for non-existent suggestion', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .patch(`/api/v1/admin/suggestions/${fakeId}/approve`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ reason: 'Approved' });

            expect(res.status).toBe(404);
        });

        it('should reject approval of already approved suggestion', async () => {
            const suggestion = await Suggestion.create({
                workerId: worker._id,
                type: 'new_category',
                payload: { name: 'Already Done', description: 'Test' },
                status: 'approved',
                approveReason: 'Already approved'
            });

            const res = await request(app)
                .patch(`/api/v1/admin/suggestions/${suggestion._id}/approve`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ reason: 'Try again' });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/already/i);
        });

        it('should require admin authentication', async () => {
            const suggestion = await Suggestion.create({
                workerId: worker._id,
                type: 'new_category',
                payload: { name: 'Auth Test', description: 'Test' },
                status: 'pending'
            });

            const res = await request(app)
                .patch(`/api/v1/admin/suggestions/${suggestion._id}/approve`)
                .send({ reason: 'Approved' });

            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const suggestion = await Suggestion.create({
                workerId: worker._id,
                type: 'new_category',
                payload: { name: 'Admin Only', description: 'Test' },
                status: 'pending'
            });

            const res = await request(app)
                .patch(`/api/v1/admin/suggestions/${suggestion._id}/approve`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ reason: 'Approved' });

            expect(res.status).toBe(403);
        });
    });

    describe('PATCH /api/v1/admin/suggestions/:id/reject', () => {
        it('should reject a suggestion with a reason', async () => {
            const suggestion = await Suggestion.create({
                workerId: worker._id,
                type: 'new_category',
                payload: { name: 'Bad Idea', description: 'Not suitable' },
                status: 'pending',
                source: 'worker'
            });

            const res = await request(app)
                .patch(`/api/v1/admin/suggestions/${suggestion._id}/reject`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ reason: 'Does not fit our platform scope' });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('rejected');
            expect(res.body.data.rejectReason).toBe('Does not fit our platform scope');
        });

        it('should return 400 when rejection reason is missing', async () => {
            const suggestion = await Suggestion.create({
                workerId: worker._id,
                type: 'new_category',
                payload: { name: 'No Reason', description: 'Test' },
                status: 'pending'
            });

            const res = await request(app)
                .patch(`/api/v1/admin/suggestions/${suggestion._id}/reject`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(res.status).toBe(400);
        });

        it('should return 404 for non-existent suggestion', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .patch(`/api/v1/admin/suggestions/${fakeId}/reject`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ reason: 'Rejected' });

            expect(res.status).toBe(404);
        });

        it('should reject rejection of already rejected suggestion', async () => {
            const suggestion = await Suggestion.create({
                workerId: worker._id,
                type: 'new_category',
                payload: { name: 'Already Rejected', description: 'Test' },
                status: 'rejected',
                rejectReason: 'Already rejected'
            });

            const res = await request(app)
                .patch(`/api/v1/admin/suggestions/${suggestion._id}/reject`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ reason: 'Try again' });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/already/i);
        });

        it('should require admin authentication', async () => {
            const suggestion = await Suggestion.create({
                workerId: worker._id,
                type: 'new_category',
                payload: { name: 'Auth Reject', description: 'Test' },
                status: 'pending'
            });

            const res = await request(app)
                .patch(`/api/v1/admin/suggestions/${suggestion._id}/reject`)
                .send({ reason: 'Rejected' });

            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const suggestion = await Suggestion.create({
                workerId: worker._id,
                type: 'new_category',
                payload: { name: 'Non Admin', description: 'Test' },
                status: 'pending'
            });

            const res = await request(app)
                .patch(`/api/v1/admin/suggestions/${suggestion._id}/reject`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ reason: 'Rejected' });

            expect(res.status).toBe(403);
        });
    });
});
