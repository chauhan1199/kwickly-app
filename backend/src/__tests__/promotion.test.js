const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const { Banner, Promotion } = require('../modules/promotion/promotion.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Promotion Routes', () => {
    let adminToken, customerToken;

    beforeEach(async () => {
        const ts = Date.now().toString(36);
        const admin = await createTestUser({ role: 'ADMIN', email: `promoadmin_${ts}@test.com`, phone: `83${ts.slice(-8).padStart(8,'0')}` });
        adminToken = generateToken(admin);

        const customer = await createTestUser({ role: 'CUSTOMER', email: `promocust_${ts}@test.com`, phone: `84${ts.slice(-8).padStart(8,'0')}` });
        customerToken = generateToken(customer);
    });

    // ─── Helper factories ─────────────────────────────────────────────────────

    const createBanner = (overrides = {}) =>
        Banner.create({
            title: 'Test Banner',
            imageUrl: 'https://example.com/banner.jpg',
            position: 'HOME_TOP',
            isActive: true,
            priority: 0,
            ...overrides
        });

    const createPromotion = (overrides = {}) =>
        Promotion.create({
            code: 'TESTPROMO',
            title: 'Test Promo',
            type: 'FLAT_DISCOUNT',
            value: 50,
            isActive: true,
            ...overrides
        });

    // ───────────────────────────────────────────────────────────────────────────
    // PUBLIC: GET /api/v1/promotions/banners
    // ───────────────────────────────────────────────────────────────────────────
    describe('GET /api/v1/promotions/banners (public)', () => {
        it('should return only active banners', async () => {
            await createBanner({ title: 'Active Banner', isActive: true });
            await createBanner({ title: 'Inactive Banner', isActive: false });

            const res = await request(app).get('/api/v1/promotions/banners');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].title).toBe('Active Banner');
        });

        it('should filter banners by position', async () => {
            await createBanner({ title: 'Top', position: 'HOME_TOP' });
            await createBanner({ title: 'Middle', position: 'HOME_MIDDLE' });

            const res = await request(app).get('/api/v1/promotions/banners?position=HOME_TOP');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].position).toBe('HOME_TOP');
        });

        it('should exclude banners outside date range (expired endAt)', async () => {
            const past = new Date(Date.now() - 10 * 86400000);
            const pastEnd = new Date(Date.now() - 5 * 86400000);
            await createBanner({ title: 'Expired', endAt: pastEnd });

            const res = await request(app).get('/api/v1/promotions/banners');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });

        it('should exclude banners not yet started', async () => {
            const future = new Date(Date.now() + 10 * 86400000);
            await createBanner({ title: 'Future', startAt: future });

            const res = await request(app).get('/api/v1/promotions/banners');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });

        it('should return banners with null startAt/endAt (always valid)', async () => {
            await createBanner({ title: 'Always', startAt: null, endAt: null });

            const res = await request(app).get('/api/v1/promotions/banners');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });

        it('should sort banners by priority descending', async () => {
            await createBanner({ title: 'Low', priority: 1 });
            await createBanner({ title: 'High', priority: 10 });

            const res = await request(app).get('/api/v1/promotions/banners');
            expect(res.status).toBe(200);
            expect(res.body.data[0].title).toBe('High');
            expect(res.body.data[1].title).toBe('Low');
        });
    });

    // ───────────────────────────────────────────────────────────────────────────
    // AUTH: POST /api/v1/promotions/validate
    // ───────────────────────────────────────────────────────────────────────────
    describe('POST /api/v1/promotions/validate', () => {
        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/promotions/validate')
                .send({ code: 'TEST', orderAmount: 100 });
            expect(res.status).toBe(401);
        });

        it('should return discount for valid FLAT_DISCOUNT promo', async () => {
            await createPromotion({ code: 'FLAT50', type: 'FLAT_DISCOUNT', value: 50 });

            const res = await request(app)
                .post('/api/v1/promotions/validate')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ code: 'FLAT50', orderAmount: 200 });

            expect(res.status).toBe(200);
            expect(res.body.data.discount).toBe(50);
            expect(res.body.data.type).toBe('FLAT_DISCOUNT');
        });

        it('should return percentage discount (uncapped)', async () => {
            await createPromotion({ code: 'PCT10', type: 'PERCENTAGE_DISCOUNT', value: 10 });

            const res = await request(app)
                .post('/api/v1/promotions/validate')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ code: 'PCT10', orderAmount: 1000 });

            expect(res.status).toBe(200);
            expect(res.body.data.discount).toBe(100);
        });

        it('should cap percentage discount by maxDiscountCap', async () => {
            await createPromotion({
                code: 'PCT20', type: 'PERCENTAGE_DISCOUNT', value: 20,
                maxDiscountCap: 150
            });

            const res = await request(app)
                .post('/api/v1/promotions/validate')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ code: 'PCT20', orderAmount: 5000 });

            expect(res.status).toBe(200);
            expect(res.body.data.discount).toBe(150);
        });

        it('should reject invalid promo code', async () => {
            const res = await request(app)
                .post('/api/v1/promotions/validate')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ code: 'NONEXISTENT', orderAmount: 100 });

            expect(res.status).toBe(404);
        });

        it('should reject inactive promo code', async () => {
            await createPromotion({ code: 'INACTIVE', isActive: false });

            const res = await request(app)
                .post('/api/v1/promotions/validate')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ code: 'INACTIVE', orderAmount: 100 });

            expect(res.status).toBe(404);
        });

        it('should reject expired promo code', async () => {
            const past = new Date(Date.now() - 5 * 86400000);
            await createPromotion({ code: 'EXPIRED', endAt: past });

            const res = await request(app)
                .post('/api/v1/promotions/validate')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ code: 'EXPIRED', orderAmount: 100 });

            expect(res.status).toBe(400);
        });

        it('should reject when usage limit reached', async () => {
            await createPromotion({ code: 'LIMITED', maxUsesTotal: 1, usesCount: 1 });

            const res = await request(app)
                .post('/api/v1/promotions/validate')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ code: 'LIMITED', orderAmount: 100 });

            expect(res.status).toBe(400);
        });

        it('should reject when order amount below minimum', async () => {
            await createPromotion({ code: 'MINORDER', minOrderAmount: 500 });

            const res = await request(app)
                .post('/api/v1/promotions/validate')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ code: 'MINORDER', orderAmount: 200 });

            expect(res.status).toBe(400);
        });

        it('should accept order amount exactly at minimum', async () => {
            await createPromotion({ code: 'MINEXACT', minOrderAmount: 500, type: 'FLAT_DISCOUNT', value: 50 });

            const res = await request(app)
                .post('/api/v1/promotions/validate')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ code: 'MINEXACT', orderAmount: 500 });

            expect(res.status).toBe(200);
            expect(res.body.data.discount).toBe(50);
        });

        it('should reject promo when user role not in applicableRoles', async () => {
            await createPromotion({
                code: 'WORKERONLY',
                applicableRoles: ['WORKER', 'SHOP']
            });

            const res = await request(app)
                .post('/api/v1/promotions/validate')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ code: 'WORKERONLY', orderAmount: 100, userRole: 'CUSTOMER' });

            expect(res.status).toBe(400);
        });

        it('should accept promo when user role is in applicableRoles', async () => {
            await createPromotion({
                code: 'CUSTOMEROK',
                applicableRoles: ['CUSTOMER'],
                type: 'FLAT_DISCOUNT',
                value: 25
            });

            const res = await request(app)
                .post('/api/v1/promotions/validate')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ code: 'CUSTOMEROK', orderAmount: 100, userRole: 'CUSTOMER' });

            expect(res.status).toBe(200);
            expect(res.body.data.discount).toBe(25);
        });

        it('should allow promo with empty applicableRoles (applies to all)', async () => {
            await createPromotion({
                code: 'ALLROLES',
                applicableRoles: [],
                type: 'FLAT_DISCOUNT',
                value: 10
            });

            const res = await request(app)
                .post('/api/v1/promotions/validate')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ code: 'ALLROLES', orderAmount: 100, userRole: 'CUSTOMER' });

            expect(res.status).toBe(200);
            expect(res.body.data.discount).toBe(10);
        });

        it('should not increment usesCount on validation (incremented on order placement)', async () => {
            await createPromotion({ code: 'INCR', type: 'FLAT_DISCOUNT', value: 10, usesCount: 0 });

            await request(app)
                .post('/api/v1/promotions/validate')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ code: 'INCR', orderAmount: 100 });

            const promo = await Promotion.findOne({ code: 'INCR' });
            // usesCount is incremented by shoporder.placeOrder, not by validatePromoCode
            expect(promo.usesCount).toBe(0);
        });

        it('should return correct metadata in response', async () => {
            await createPromotion({
                code: 'META', type: 'FLAT_DISCOUNT', value: 30,
                title: 'Meta Test', description: 'Test description'
            });

            const res = await request(app)
                .post('/api/v1/promotions/validate')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ code: 'META', orderAmount: 100 });

            expect(res.status).toBe(200);
            expect(res.body.data.code).toBe('META');
            expect(res.body.data.title).toBe('Meta Test');
            expect(res.body.data.description).toBe('Test description');
            expect(res.body.data.type).toBe('FLAT_DISCOUNT');
        });
    });

    // ───────────────────────────────────────────────────────────────────────────
    // ADMIN: Banner CRUD
    // ───────────────────────────────────────────────────────────────────────────
    describe('Admin Banner Routes', () => {
        describe('GET /api/v1/promotions/banners/all', () => {
            it('should return all banners including inactive', async () => {
                await createBanner({ title: 'Active', isActive: true });
                await createBanner({ title: 'Inactive', isActive: false });

                const res = await request(app)
                    .get('/api/v1/promotions/banners/all')
                    .set('Authorization', `Bearer ${adminToken}`);

                expect(res.status).toBe(200);
                expect(res.body.data).toHaveLength(2);
            });

            it('should reject non-admin', async () => {
                const res = await request(app)
                    .get('/api/v1/promotions/banners/all')
                    .set('Authorization', `Bearer ${customerToken}`);
                expect(res.status).toBe(403);
            });

            it('should reject unauthenticated', async () => {
                const res = await request(app).get('/api/v1/promotions/banners/all');
                expect(res.status).toBe(401);
            });
        });

        describe('POST /api/v1/promotions/banners', () => {
            it('should create a banner', async () => {
                const res = await request(app)
                    .post('/api/v1/promotions/banners')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({ title: 'New Banner', imageUrl: 'https://example.com/img.jpg', position: 'HOME_TOP' });

                expect(res.status).toBe(201);
                expect(res.body.data.title).toBe('New Banner');
                expect(res.body.data.imageUrl).toBe('https://example.com/img.jpg');
            });

            it('should reject missing title', async () => {
                const res = await request(app)
                    .post('/api/v1/promotions/banners')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({ imageUrl: 'https://example.com/img.jpg' });

                expect(res.status).toBe(400);
            });

            it('should reject missing imageUrl', async () => {
                const res = await request(app)
                    .post('/api/v1/promotions/banners')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({ title: 'No Image' });

                expect(res.status).toBe(400);
            });

            it('should reject non-admin', async () => {
                const res = await request(app)
                    .post('/api/v1/promotions/banners')
                    .set('Authorization', `Bearer ${customerToken}`)
                    .send({ title: 'X', imageUrl: 'https://x.com/x.jpg' });
                expect(res.status).toBe(403);
            });
        });

        describe('PATCH /api/v1/promotions/banners/:id', () => {
            it('should update a banner', async () => {
                const banner = await createBanner({ title: 'Old Title' });

                const res = await request(app)
                    .patch(`/api/v1/promotions/banners/${banner._id}`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({ title: 'New Title' });

                expect(res.status).toBe(200);
                expect(res.body.data.title).toBe('New Title');
            });

            it('should return 404 for non-existent banner', async () => {
                const fakeId = '507f1f77bcf86cd799439011';
                const res = await request(app)
                    .patch(`/api/v1/promotions/banners/${fakeId}`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({ title: 'Ghost' });

                expect(res.status).toBe(404);
            });

            it('should reject non-admin', async () => {
                const banner = await createBanner();
                const res = await request(app)
                    .patch(`/api/v1/promotions/banners/${banner._id}`)
                    .set('Authorization', `Bearer ${customerToken}`)
                    .send({ title: 'Hacked' });
                expect(res.status).toBe(403);
            });
        });

        describe('DELETE /api/v1/promotions/banners/:id', () => {
            it('should delete a banner', async () => {
                const banner = await createBanner({ title: 'ToDelete' });

                const res = await request(app)
                    .delete(`/api/v1/promotions/banners/${banner._id}`)
                    .set('Authorization', `Bearer ${adminToken}`);

                expect(res.status).toBe(200);
                const found = await Banner.findById(banner._id);
                expect(found).toBeNull();
            });

            it('should return 404 for non-existent banner', async () => {
                const fakeId = '507f1f77bcf86cd799439011';
                const res = await request(app)
                    .delete(`/api/v1/promotions/banners/${fakeId}`)
                    .set('Authorization', `Bearer ${adminToken}`);

                expect(res.status).toBe(404);
            });

            it('should reject non-admin', async () => {
                const banner = await createBanner();
                const res = await request(app)
                    .delete(`/api/v1/promotions/banners/${banner._id}`)
                    .set('Authorization', `Bearer ${customerToken}`);
                expect(res.status).toBe(403);
            });
        });
    });

    // ───────────────────────────────────────────────────────────────────────────
    // ADMIN: Promotion CRUD
    // ───────────────────────────────────────────────────────────────────────────
    describe('Admin Promotion Routes', () => {
        describe('GET /api/v1/promotions/promotions', () => {
            it('should return all promotions', async () => {
                await createPromotion({ code: 'PROMO1', title: 'Promo 1' });
                await createPromotion({ code: 'PROMO2', title: 'Promo 2' });

                const res = await request(app)
                    .get('/api/v1/promotions/promotions')
                    .set('Authorization', `Bearer ${adminToken}`);

                expect(res.status).toBe(200);
                expect(res.body.data).toHaveLength(2);
            });

            it('should reject non-admin', async () => {
                const res = await request(app)
                    .get('/api/v1/promotions/promotions')
                    .set('Authorization', `Bearer ${customerToken}`);
                expect(res.status).toBe(403);
            });
        });

        describe('POST /api/v1/promotions/promotions', () => {
            it('should create a promotion', async () => {
                const res = await request(app)
                    .post('/api/v1/promotions/promotions')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({
                        code: 'NEWCODE', title: 'New Promo',
                        type: 'FLAT_DISCOUNT', value: 100
                    });

                expect(res.status).toBe(201);
                expect(res.body.data.code).toBe('NEWCODE');
                expect(res.body.data.value).toBe(100);
            });

            it('should uppercase the code on save', async () => {
                const res = await request(app)
                    .post('/api/v1/promotions/promotions')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({
                        code: 'lowercase', title: 'Lower',
                        type: 'PERCENTAGE_DISCOUNT', value: 10
                    });

                expect(res.status).toBe(201);
                expect(res.body.data.code).toBe('LOWERCASE');
            });

            it('should reject duplicate code', async () => {
                await createPromotion({ code: 'DUP' });

                const res = await request(app)
                    .post('/api/v1/promotions/promotions')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({ code: 'DUP', title: 'Dup', type: 'FLAT_DISCOUNT', value: 10 });

                expect(res.status).toBe(409);
            });

            it('should reject missing required fields', async () => {
                const res = await request(app)
                    .post('/api/v1/promotions/promotions')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({ title: 'No Code' });

                expect(res.status).toBe(400);
            });

            it('should reject non-admin', async () => {
                const res = await request(app)
                    .post('/api/v1/promotions/promotions')
                    .set('Authorization', `Bearer ${customerToken}`)
                    .send({ code: 'X', title: 'X', type: 'FLAT_DISCOUNT', value: 10 });
                expect(res.status).toBe(403);
            });
        });

        describe('PATCH /api/v1/promotions/promotions/:id', () => {
            it('should update a promotion', async () => {
                const promo = await createPromotion({ code: 'UPDATABLE', value: 50 });

                const res = await request(app)
                    .patch(`/api/v1/promotions/promotions/${promo._id}`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({ value: 200 });

                expect(res.status).toBe(200);
                expect(res.body.data.value).toBe(200);
            });

            it('should return 404 for non-existent promotion', async () => {
                const fakeId = '507f1f77bcf86cd799439011';
                const res = await request(app)
                    .patch(`/api/v1/promotions/promotions/${fakeId}`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({ value: 999 });

                expect(res.status).toBe(404);
            });

            it('should reject non-admin', async () => {
                const promo = await createPromotion({ code: 'NOUPDATE' });
                const res = await request(app)
                    .patch(`/api/v1/promotions/promotions/${promo._id}`)
                    .set('Authorization', `Bearer ${customerToken}`)
                    .send({ value: 1 });
                expect(res.status).toBe(403);
            });
        });

        describe('DELETE /api/v1/promotions/promotions/:id', () => {
            it('should delete a promotion', async () => {
                const promo = await createPromotion({ code: 'DELETEMENOW' });

                const res = await request(app)
                    .delete(`/api/v1/promotions/promotions/${promo._id}`)
                    .set('Authorization', `Bearer ${adminToken}`);

                expect(res.status).toBe(200);
                const found = await Promotion.findById(promo._id);
                expect(found).toBeNull();
            });

            it('should return 404 for non-existent promotion', async () => {
                const fakeId = '507f1f77bcf86cd799439011';
                const res = await request(app)
                    .delete(`/api/v1/promotions/promotions/${fakeId}`)
                    .set('Authorization', `Bearer ${adminToken}`);

                expect(res.status).toBe(404);
            });

            it('should reject non-admin', async () => {
                const promo = await createPromotion({ code: 'NODELETE' });
                const res = await request(app)
                    .delete(`/api/v1/promotions/promotions/${promo._id}`)
                    .set('Authorization', `Bearer ${customerToken}`);
                expect(res.status).toBe(403);
            });
        });
    });
});
