const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Category = require('../modules/category/category.model');
const Suggestion = require('../modules/suggestion/suggestion.model');
const mongoose = require('mongoose');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Category Management — Complete E2E', () => {
    let adminToken, workerToken, customerToken;

    beforeEach(async () => {
        const admin = await createTestUser({ role: 'ADMIN', email: 'cat-admin@test.com', phone: '9000000001' });
        adminToken = generateToken(admin);

        const worker = await createTestUser({ role: 'WORKER', email: 'cat-worker@test.com', phone: '9000000002', name: 'Test Worker' });
        workerToken = generateToken(worker);

        const customer = await createTestUser({ role: 'CUSTOMER', email: 'cat-customer@test.com', phone: '9000000003', name: 'Test Customer' });
        customerToken = generateToken(customer);
    });

    // ─── 1. Create Category ────────────────────────────────────────────────────
    describe('1. Create Category', () => {
        it('should create category with all fields', async () => {
            const res = await request(app)
                .post('/api/v1/admin/categories')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Plumbing', icon: '🔧', color: '#2563EB', description: 'All water-related repairs.', active: true });

            expect(res.status).toBe(201);
            expect(res.body.data.name).toBe('Plumbing');
            expect(res.body.data.icon).toBe('🔧');
            expect(res.body.data.color).toBe('#2563EB');
            expect(res.body.data.description).toBe('All water-related repairs.');
            expect(res.body.data.active).toBe(true);
            expect(res.body.data.subcategories).toEqual([]);
        });

        it('should create category with subcategories inline', async () => {
            const res = await request(app)
                .post('/api/v1/admin/categories')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Electrical', icon: '⚡', color: '#F97316', description: 'Electrical services.',
                    subcategories: [
                        { name: 'Switch Repair', minPrice: 99, platformFee: 20, suggestedMax: 300, active: true },
                        { name: 'Wiring Repair', minPrice: 499, platformFee: 100, suggestedMax: 5000, active: true }
                    ]
                });

            expect(res.status).toBe(201);
            expect(res.body.data.subcategories.length).toBe(2);
            expect(res.body.data.subcategories[0].name).toBe('Switch Repair');
            expect(res.body.data.subcategories[0].minPrice).toBe(99);
            expect(res.body.data.subcategories[1].name).toBe('Wiring Repair');
        });

        it('should reject creating category with duplicate name', async () => {
            await Category.create({ name: 'Plumbing', icon: '🔧', color: '#000', description: 'Test' });

            const res = await request(app)
                .post('/api/v1/admin/categories')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Plumbing', icon: '🔧', color: '#000', description: 'Duplicate' });

            expect([400, 409]).toContain(res.status);
        });

        it('should reject creating category with missing required fields', async () => {
            const res = await request(app)
                .post('/api/v1/admin/categories')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ description: 'Missing name' });

            expect([400, 429, 500]).toContain(res.status);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/admin/categories')
                .send({ name: 'Test', icon: '🔧', color: '#000', description: 'Test' });

            expect([401, 403]).toContain(res.status);
        });

        it('should reject non-admin', async () => {
            const res = await request(app)
                .post('/api/v1/admin/categories')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ name: 'Test', icon: '🔧', color: '#000', description: 'Test' });

            expect(res.status).toBe(403);
        });
    });

    // ─── 2. List Categories ────────────────────────────────────────────────────
    describe('2. List Categories', () => {
        it('should list all categories (public)', async () => {
            await Category.deleteMany({});
            await Category.create([
                { name: 'Plumbing', icon: '🔧', color: '#000', description: 'Water repairs' },
                { name: 'Electrical', icon: '⚡', color: '#fff', description: 'Electric repairs' }
            ]);

            const res = await request(app).get('/api/v1/categories');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBe(2);
        });

        it('should return empty array when no categories', async () => {
            await Category.deleteMany({});
            const count = await Category.countDocuments();
            expect(count).toBe(0);
        });

        it('should not require authentication', async () => {
            const res = await request(app).get('/api/v1/categories');
            expect(res.status).toBe(200);
        });

        it('should populate subcategories', async () => {
            const cat = await Category.create({
                name: 'AC Service', icon: '❄️', color: '#0EA5E9', description: 'AC services.'
            });
            await Category.findByIdAndUpdate(cat._id, {
                $push: {
                    subcategories: {
                        $each: [
                            { name: 'AC Repair', minPrice: 599, platformFee: 120, suggestedMax: 2500, active: true },
                            { name: 'Gas Refilling', minPrice: 1200, platformFee: 250, suggestedMax: 3500, active: true }
                        ]
                    }
                }
            });

            const updated = await Category.findById(cat._id);
            expect(updated.subcategories.length).toBe(2);
            expect(updated.subcategories[0].name).toBe('AC Repair');
            expect(updated.subcategories[0].minPrice).toBe(599);
            expect(updated.subcategories[1].name).toBe('Gas Refilling');
        });
    });

    // ─── 3. Update Category ────────────────────────────────────────────────────
    describe('3. Update Category', () => {
        it('should update category name', async () => {
            const cat = await Category.create({ name: 'Plumbing', icon: '🔧', color: '#000', description: 'Test' });

            const res = await request(app)
                .patch(`/api/v1/admin/categories/${cat._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Plumbing Updated' });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Plumbing Updated');
        });

        it('should update category description and color', async () => {
            const cat = await Category.create({ name: 'Test', icon: '🔧', color: '#000', description: 'Old desc' });

            const res = await request(app)
                .patch(`/api/v1/admin/categories/${cat._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ description: 'New description', color: '#FF0000' });

            expect(res.status).toBe(200);
            expect(res.body.data.description).toBe('New description');
            expect(res.body.data.color).toBe('#FF0000');
        });

        it('should toggle category active status', async () => {
            const cat = await Category.create({ name: 'Test', icon: '🔧', color: '#000', description: 'Test', active: true });

            const res = await request(app)
                .patch(`/api/v1/admin/categories/${cat._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ active: false });

            expect(res.status).toBe(200);
            expect(res.body.data.active).toBe(false);
        });

        it('should replace subcategories array', async () => {
            const cat = await Category.create({
                name: 'Test', icon: '🔧', color: '#000', description: 'Test',
                subcategories: [{ name: 'Old Sub', active: true }]
            });

            const res = await request(app)
                .patch(`/api/v1/admin/categories/${cat._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ subcategories: [{ name: 'New Sub', minPrice: 100, active: true }] });

            expect(res.status).toBe(200);
            expect(res.body.data.subcategories.length).toBe(1);
            expect(res.body.data.subcategories[0].name).toBe('New Sub');
            expect(res.body.data.subcategories[0].minPrice).toBe(100);
        });

        it('should return 404 for non-existent category', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .patch(`/api/v1/admin/categories/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Updated' });

            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated update', async () => {
            const cat = await Category.create({ name: 'Test', icon: '🔧', color: '#000', description: 'Test' });

            const res = await request(app)
                .patch(`/api/v1/admin/categories/${cat._id}`)
                .send({ name: 'Hacked' });

            expect(res.status).toBe(401);
        });
    });

    // ─── 4. Delete Category ────────────────────────────────────────────────────
    describe('4. Delete Category', () => {
        it('should delete category', async () => {
            const cat = await Category.create({ name: 'To Delete', icon: '🗑️', color: '#000', description: 'Test' });

            const res = await request(app)
                .delete(`/api/v1/admin/categories/${cat._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);

            const check = await Category.findById(cat._id);
            expect(check).toBeNull();
        });

        it('should return 404 for non-existent category', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .delete(`/api/v1/admin/categories/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });

        it('should reject non-admin delete', async () => {
            const cat = await Category.create({ name: 'Test', icon: '🔧', color: '#000', description: 'Test' });

            const res = await request(app)
                .delete(`/api/v1/admin/categories/${cat._id}`)
                .set('Authorization', `Bearer ${workerToken}`);

            expect(res.status).toBe(403);
        });
    });

    // ─── 5. Subcategory CRUD ───────────────────────────────────────────────────
    describe('5. Subcategory Management', () => {
        it('should add subcategory with price fields', async () => {
            const cat = await Category.create({ name: 'Plumbing', icon: '🔧', color: '#000', description: 'Test' });

            const res = await request(app)
                .post(`/api/v1/admin/categories/${cat._id}/subcategories`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Pipe Repair', description: 'Fix pipe leaks', minPrice: 249, platformFee: 50, suggestedMax: 800, active: true });

            expect(res.status).toBe(200);
            const updated = await Category.findById(cat._id);
            expect(updated.subcategories.length).toBe(1);
            expect(updated.subcategories[0].name).toBe('Pipe Repair');
            expect(updated.subcategories[0].minPrice).toBe(249);
            expect(updated.subcategories[0].platformFee).toBe(50);
            expect(updated.subcategories[0].suggestedMax).toBe(800);
        });

        it('should add multiple subcategories', async () => {
            const cat = await Category.create({ name: 'Electrical', icon: '⚡', color: '#000', description: 'Test' });

            await request(app)
                .post(`/api/v1/admin/categories/${cat._id}/subcategories`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Switch Repair', minPrice: 99 });

            await request(app)
                .post(`/api/v1/admin/categories/${cat._id}/subcategories`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Wiring Repair', minPrice: 499 });

            const updated = await Category.findById(cat._id);
            expect(updated.subcategories.length).toBe(2);
        });

        it('should return 404 when adding subcategory to non-existent category', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .post(`/api/v1/admin/categories/${fakeId}/subcategories`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Test Sub' });

            expect(res.status).toBe(404);
        });

        it('should update subcategory via replace array', async () => {
            const cat = await Category.create({
                name: 'AC Service', icon: '❄️', color: '#000', description: 'Test',
                subcategories: [
                    { name: 'AC Repair', minPrice: 599, active: true },
                    { name: 'Gas Refill', minPrice: 1200, active: true }
                ]
            });

            const res = await request(app)
                .patch(`/api/v1/admin/categories/${cat._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    subcategories: [
                        { name: 'AC Repair', minPrice: 699, active: true },
                        { name: 'Gas Refill', minPrice: 1200, active: false },
                        { name: 'AC Installation', minPrice: 999, active: true }
                    ]
                });

            expect(res.status).toBe(200);
            expect(res.body.data.subcategories.length).toBe(3);
            expect(res.body.data.subcategories[0].minPrice).toBe(699);
            expect(res.body.data.subcategories[1].active).toBe(false);
            expect(res.body.data.subcategories[2].name).toBe('AC Installation');
        });

        it('should toggle subcategory active status', async () => {
            const cat = await Category.create({
                name: 'Test', icon: '🔧', color: '#000', description: 'Test',
                subcategories: [{ name: 'Sub1', active: true }]
            });

            const newSubs = cat.subcategories.map(s => ({ ...s.toObject(), active: !s.active }));
            const res = await request(app)
                .patch(`/api/v1/admin/categories/${cat._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ subcategories: newSubs });

            expect(res.status).toBe(200);
            expect(res.body.data.subcategories[0].active).toBe(false);
        });

        it('should reject subcategory add by non-admin', async () => {
            const cat = await Category.create({ name: 'Test', icon: '🔧', color: '#000', description: 'Test' });

            const res = await request(app)
                .post(`/api/v1/admin/categories/${cat._id}/subcategories`)
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ name: 'Sub' });

            expect(res.status).toBe(403);
        });
    });

    // ─── 6. Category Suggestions ───────────────────────────────────────────────
    describe('6. Category Suggestions', () => {
        it('should list suggestions', async () => {
            await Suggestion.create({
                workerId: (await createTestUser({ role: 'WORKER', email: 'sug1@test.com', phone: '9000000010' }))._id,
                workerName: 'Test Worker', workerCity: 'Mumbai',
                type: 'new_category', status: 'PENDING',
                payload: { name: 'Gardening', icon: '🌿', description: 'Plant care', suggestedSubcategories: ['Lawn Mowing'] }
            });

            const res = await request(app)
                .get('/api/v1/admin/categories/suggestions')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
        });

        it('should return empty when no suggestions', async () => {
            const res = await request(app)
                .get('/api/v1/admin/categories/suggestions')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });

        it('should approve new category suggestion', async () => {
            const w = await createTestUser({ role: 'WORKER', email: 'sug2@test.com', phone: '9000000011' });
            const suggestion = await Suggestion.create({
                workerId: w._id, workerName: 'Test Worker', workerCity: 'Delhi',
                type: 'new_category', status: 'PENDING',
                payload: { name: 'Gardening', icon: '🌿', description: 'Plant care', suggestedSubcategories: ['Lawn Mowing', 'Tree Trimming'] }
            });

            const res = await request(app)
                .patch(`/api/v1/admin/categories/suggestions/${suggestion._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'APPROVED', adminFeedback: 'Great suggestion!' });

            expect(res.status).toBe(200);

            // Verify category was created
            const cat = await Category.findOne({ name: 'Gardening' });
            expect(cat).not.toBeNull();
            expect(cat.icon).toBe('🌿');
            expect(cat.subcategories.length).toBe(2);
            expect(cat.subcategories[0].name).toBe('Lawn Mowing');
        });

        it('should approve subcategory suggestion', async () => {
            const parentCat = await Category.create({ name: 'Plumbing', icon: '🔧', color: '#000', description: 'Test' });
            const w = await createTestUser({ role: 'WORKER', email: 'sug3@test.com', phone: '9000000012' });
            const suggestion = await Suggestion.create({
                workerId: w._id, workerName: 'Test Worker', workerCity: 'Mumbai',
                type: 'new_subcategory', status: 'PENDING',
                payload: { parentCategory: 'Plumbing', parentCategoryId: parentCat._id, name: 'Drain Cleaning', description: 'Clean drains' }
            });

            const res = await request(app)
                .patch(`/api/v1/admin/categories/suggestions/${suggestion._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'APPROVED' });

            expect(res.status).toBe(200);

            const updated = await Category.findById(parentCat._id);
            expect(updated.subcategories.length).toBe(1);
            expect(updated.subcategories[0].name).toBe('Drain Cleaning');
        });

        it('should reject suggestion', async () => {
            const w = await createTestUser({ role: 'WORKER', email: 'sug4@test.com', phone: '9000000013' });
            const suggestion = await Suggestion.create({
                workerId: w._id, workerName: 'Test', workerCity: 'Mumbai',
                type: 'new_category', status: 'PENDING',
                payload: { name: 'Spam Category', icon: '🚫', description: 'Spam' }
            });

            const res = await request(app)
                .patch(`/api/v1/admin/categories/suggestions/${suggestion._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'REJECTED', adminFeedback: 'Not relevant' });

            expect(res.status).toBe(200);

            const updated = await Suggestion.findById(suggestion._id);
            expect(updated.status).toBe('REJECTED');

            // Verify no category was created
            const cat = await Category.findOne({ name: 'Spam Category' });
            expect(cat).toBeNull();
        });

        it('should return 404 for non-existent suggestion', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .patch(`/api/v1/admin/categories/suggestions/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'APPROVED' });

            expect(res.status).toBe(404);
        });

        it('should reject non-admin from listing suggestions', async () => {
            const res = await request(app)
                .get('/api/v1/admin/categories/suggestions')
                .set('Authorization', `Bearer ${workerToken}`);

            expect(res.status).toBe(403);
        });
    });

    // ─── 7. Full CRUD Lifecycle ────────────────────────────────────────────────
    describe('7. Full CRUD Lifecycle', () => {
        it('should complete: create → add subcategories → update → delete', async () => {
            // CREATE
            const createRes = await request(app)
                .post('/api/v1/admin/categories')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Home Services', icon: '🏠', color: '#2563EB', description: 'Home services' });
            expect(createRes.status).toBe(201);
            const catId = createRes.body.data._id;

            // ADD SUBCATEGORIES
            await request(app)
                .post(`/api/v1/admin/categories/${catId}/subcategories`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'AC Repair', minPrice: 599, platformFee: 120, suggestedMax: 2500 });

            await request(app)
                .post(`/api/v1/admin/categories/${catId}/subcategories`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Plumbing', minPrice: 249, platformFee: 50, suggestedMax: 800 });

            // READ - verify subcategories
            const listRes = await request(app).get('/api/v1/categories');
            const cat = listRes.body.data.find(c => c._id === catId);
            expect(cat.subcategories.length).toBe(2);

            // UPDATE category
            const updateRes = await request(app)
                .patch(`/api/v1/admin/categories/${catId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ description: 'Updated description' });
            expect(updateRes.status).toBe(200);
            expect(updateRes.body.data.description).toBe('Updated description');

            // UPDATE subcategory prices
            const updatedCat = await Category.findById(catId);
            const newSubs = updatedCat.subcategories.map(s => ({
                ...s.toObject(),
                minPrice: s.minPrice + 100
            }));
            const subUpdateRes = await request(app)
                .patch(`/api/v1/admin/categories/${catId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ subcategories: newSubs });
            expect(subUpdateRes.status).toBe(200);
            expect(subUpdateRes.body.data.subcategories[0].minPrice).toBe(699);

            // TOGGLE active
            const toggleRes = await request(app)
                .patch(`/api/v1/admin/categories/${catId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ active: false });
            expect(toggleRes.body.data.active).toBe(false);

            // DELETE
            const deleteRes = await request(app)
                .delete(`/api/v1/admin/categories/${catId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(deleteRes.status).toBe(200);

            // VERIFY DELETED
            const checkRes = await request(app).get('/api/v1/categories');
            const deleted = checkRes.body.data.find(c => c._id === catId);
            expect(deleted).toBeUndefined();
        });
    });

    // ─── 8. Suggestion Lifecycle ────────────────────────────────────────────────
    describe('8. Suggestion Lifecycle', () => {
        it('should complete: worker suggests → admin approves → category created', async () => {
            const worker = await createTestUser({ role: 'WORKER', email: 'lifecycle-worker@test.com', phone: '9000000020', name: 'Lifecycle Worker' });

            // Worker creates suggestion (via model directly, simulating mobile app)
            const suggestion = await Suggestion.create({
                workerId: worker._id, workerName: worker.name, workerCity: 'Mumbai',
                type: 'new_category', status: 'PENDING',
                payload: {
                    name: 'Event Services',
                    icon: '📸',
                    description: 'Photography, decoration, DJ services.',
                    suggestedSubcategories: ['Wedding Photography', 'Birthday Decoration', 'DJ Service']
                }
            });

            // Admin lists suggestions
            const listRes = await request(app)
                .get('/api/v1/admin/categories/suggestions')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(listRes.body.data.length).toBe(1);
            expect(listRes.body.data[0].status).toBe('PENDING');

            // Admin approves
            const approveRes = await request(app)
                .patch(`/api/v1/admin/categories/suggestions/${suggestion._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'APPROVED', adminFeedback: 'Great category!' });
            expect(approveRes.status).toBe(200);

            // Verify category was created
            const catRes = await request(app).get('/api/v1/categories');
            const newCat = catRes.body.data.find(c => c.name === 'Event Services');
            expect(newCat).toBeDefined();
            expect(newCat.icon).toBe('📸');
            expect(newCat.subcategories.length).toBe(3);
            expect(newCat.subcategories.map(s => s.name).sort()).toEqual(['Wedding Photography', 'Birthday Decoration', 'DJ Service'].sort());
        });
    });
});
