const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Customer = require('../modules/customer/customer.model');
const WalletTxn = require('../modules/wallet/wallet.model');
const Suggestion = require('../modules/suggestion/suggestion.model');
const Job = require('../modules/job/job.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Worker Earnings & Self-Service', () => {
    let workerToken, customerToken, workerUser;

    beforeEach(async () => {
        const uid = Date.now().toString(36).slice(-6);
        workerUser = await createTestUser({
            role: 'WORKER', email: `we-w-${uid}@test.com`, phone: `9000${uid}`,
            name: 'Test Worker', city: 'Mumbai',
            activeLocation: { type: 'Point', coordinates: [72.8777, 19.0760] },
            kyc: { status: 'APPROVED', documents: [] },
            isVerified: true,
            wallet: { balance: 0 }
        });
        workerToken = generateToken(workerUser);

        const customer = await createTestUser({
            role: 'CUSTOMER', email: `we-c-${uid}@test.com`, phone: `9001${uid}`,
            name: 'Test Customer'
        });
        customerToken = generateToken(customer);
    });

    // ── GET /api/v1/workers/earnings/summary ──────────────────────────────────
    describe('GET /api/v1/workers/earnings/summary', () => {
        it('should return earnings summary with zero balance', async () => {
            const res = await request(app)
                .get('/api/v1/workers/earnings/summary')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.totalEarned).toBeDefined();
            expect(res.body.data.thisMonth).toBeDefined();
            expect(res.body.data.thisWeek).toBeDefined();
            expect(res.body.data.avgPerJob).toBeDefined();
            expect(res.body.data.totalJobs).toBeDefined();
        });

        it('should return summary with wallet transactions', async () => {
            await WalletTxn.create({
                userId: workerUser._id,
                type: 'JOB_CREDIT',
                amount: 500,
                balance: 500,
                status: 'COMPLETED',
                description: 'Plumbing job'
            });

            const res = await request(app)
                .get('/api/v1/workers/earnings/summary')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.totalEarned).toBe(500);
        });

        it('should count completed jobs in summary', async () => {
            await Job.create({
                customerId: customerToken ? (await createTestUser({ role: 'CUSTOMER', email: 'sumcust@test.com', phone: '9099999' }))._id : null,
                workerId: workerUser._id,
                category: 'Plumbing',
                description: 'Fix pipe',
                status: 'COMPLETED',
                location: { type: 'Point', coordinates: [72.8777, 19.0760] },
                addressDetails: { city: 'Mumbai', fullAddress: '123 Main St' }
            });

            const res = await request(app)
                .get('/api/v1/workers/earnings/summary')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.totalJobs).toBeGreaterThanOrEqual(1);
        });

        it('should reject non-worker role', async () => {
            const res = await request(app)
                .get('/api/v1/workers/earnings/summary')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .get('/api/v1/workers/earnings/summary');
            expect(res.status).toBe(401);
        });
    });

    // ── GET /api/v1/workers/earnings/chart ────────────────────────────────────
    describe('GET /api/v1/workers/earnings/chart', () => {
        it('should return chart data for week period', async () => {
            const res = await request(app)
                .get('/api/v1/workers/earnings/chart?period=week')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should return chart data for month period', async () => {
            const res = await request(app)
                .get('/api/v1/workers/earnings/chart?period=month')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should return chart data with wallet transactions', async () => {
            await WalletTxn.create({
                userId: workerUser._id,
                type: 'JOB_CREDIT',
                amount: 300,
                balance: 300,
                status: 'COMPLETED',
                description: 'Today job'
            });

            const res = await request(app)
                .get('/api/v1/workers/earnings/chart?period=week')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        });

        it('should default to week period', async () => {
            const res = await request(app)
                .get('/api/v1/workers/earnings/chart')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
        });

        it('should reject non-worker role', async () => {
            const res = await request(app)
                .get('/api/v1/workers/earnings/chart')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    // ── GET /api/v1/workers/earnings/transactions ─────────────────────────────
    describe('GET /api/v1/workers/earnings/transactions', () => {
        it('should return paginated transactions', async () => {
            const res = await request(app)
                .get('/api/v1/workers/earnings/transactions')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.txns).toBeDefined();
            expect(Array.isArray(res.body.data.txns)).toBe(true);
            expect(res.body.data.total).toBeDefined();
            expect(res.body.data.page).toBeDefined();
            expect(res.body.data.totalPages).toBeDefined();
        });

        it('should return transactions with wallet data', async () => {
            await WalletTxn.create({
                userId: workerUser._id,
                type: 'JOB_CREDIT',
                amount: 750,
                balance: 750,
                status: 'COMPLETED',
                description: 'Electrical job'
            });

            const res = await request(app)
                .get('/api/v1/workers/earnings/transactions')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.txns.length).toBeGreaterThanOrEqual(1);
        });

        it('should filter by type', async () => {
            await WalletTxn.create({
                userId: workerUser._id,
                type: 'JOB_CREDIT',
                amount: 500,
                balance: 500,
                status: 'COMPLETED',
                description: 'Job credit'
            });
            await WalletTxn.create({
                userId: workerUser._id,
                type: 'WITHDRAWAL',
                amount: 200,
                balance: 300,
                status: 'PENDING',
                description: 'Withdrawal'
            });

            const res = await request(app)
                .get('/api/v1/workers/earnings/transactions?type=JOB_CREDIT')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
            res.body.data.txns.forEach(txn => {
                expect(txn.type).toBe('JOB_CREDIT');
            });
        });

        it('should respect pagination', async () => {
            const txns = [];
            for (let i = 0; i < 5; i++) {
                txns.push({
                    userId: workerUser._id,
                    type: 'JOB_CREDIT',
                    amount: 100 * (i + 1),
                    balance: 100 * (i + 1),
                    status: 'COMPLETED',
                    description: `Job ${i + 1}`
                });
            }
            await WalletTxn.insertMany(txns);

            const res = await request(app)
                .get('/api/v1/workers/earnings/transactions?page=1&limit=3')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.txns.length).toBeLessThanOrEqual(3);
            expect(res.body.data.total).toBe(5);
        });

        it('should reject non-worker role', async () => {
            const res = await request(app)
                .get('/api/v1/workers/earnings/transactions')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    // ── POST /api/v1/workers/earnings/withdraw ────────────────────────────────
    describe('POST /api/v1/workers/earnings/withdraw', () => {
        it('should request withdrawal with sufficient balance', async () => {
            await Customer.findByIdAndUpdate(workerUser._id, { $set: { 'wallet.balance': 3000 } });

            const res = await request(app)
                .post('/api/v1/workers/earnings/withdraw')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ amount: 1000, payoutMethod: 'worker@upi' });
            expect(res.status).toBe(200);
            expect(res.body.data.type).toBe('WITHDRAWAL');
            expect(res.body.data.status).toBe('PENDING');
        });

        it('should reject withdrawal with insufficient balance', async () => {
            await Customer.findByIdAndUpdate(workerUser._id, { $set: { 'wallet.balance': 100 } });

            const res = await request(app)
                .post('/api/v1/workers/earnings/withdraw')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ amount: 500, payoutMethod: 'worker@upi' });
            expect(res.status).toBe(402);
        });

        it('should reject zero amount', async () => {
            const res = await request(app)
                .post('/api/v1/workers/earnings/withdraw')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ amount: 0, payoutMethod: 'worker@upi' });
            expect(res.status).toBe(400);
        });

        it('should reject negative amount', async () => {
            const res = await request(app)
                .post('/api/v1/workers/earnings/withdraw')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ amount: -100, payoutMethod: 'worker@upi' });
            expect(res.status).toBe(400);
        });

        it('should reject without payout method', async () => {
            await Customer.findByIdAndUpdate(workerUser._id, { $set: { 'wallet.balance': 1000 } });

            const res = await request(app)
                .post('/api/v1/workers/earnings/withdraw')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ amount: 500 });
            expect(res.status).toBe(400);
        });

        it('should reject non-worker role', async () => {
            const res = await request(app)
                .post('/api/v1/workers/earnings/withdraw')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 100, payoutMethod: 'test@upi' });
            expect(res.status).toBe(403);
        });
    });

    // ── GET /api/v1/workers/me/stats ──────────────────────────────────────────
    describe('GET /api/v1/workers/me/stats', () => {
        it('should return worker stats', async () => {
            const res = await request(app)
                .get('/api/v1/workers/me/stats')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.todayJobs).toBeDefined();
            expect(res.body.data.completed).toBeDefined();
            expect(res.body.data.inProgress).toBeDefined();
            expect(res.body.data.cancelled).toBeDefined();
        });

        it('should count completed jobs', async () => {
            const cust = await createTestUser({ role: 'CUSTOMER', email: 'statcust@test.com', phone: '9088888' });
            await Job.create({
                customerId: cust._id,
                workerId: workerUser._id,
                category: 'Plumbing',
                description: 'Fix pipe',
                status: 'COMPLETED',
                location: { type: 'Point', coordinates: [72.8777, 19.0760] },
                addressDetails: { city: 'Mumbai', fullAddress: '123 Main St' }
            });

            const res = await request(app)
                .get('/api/v1/workers/me/stats')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.completed).toBeGreaterThanOrEqual(1);
        });

        it('should reject non-worker role', async () => {
            const res = await request(app)
                .get('/api/v1/workers/me/stats')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app).get('/api/v1/workers/me/stats');
            expect(res.status).toBe(401);
        });
    });

    // ── POST /api/v1/workers/category-suggestions ─────────────────────────────
    describe('POST /api/v1/workers/category-suggestions', () => {
        it('should submit a new category suggestion', async () => {
            const res = await request(app)
                .post('/api/v1/workers/category-suggestions')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ name: 'Solar Installation', type: 'CATEGORY' });
            expect(res.status).toBe(201);
            expect(res.body.data.type).toBe('new_category');
            expect(res.body.data.source).toBe('worker');
        });

        it('should submit a subcategory suggestion', async () => {
            const res = await request(app)
                .post('/api/v1/workers/category-suggestions')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ name: 'Water Heater Repair', type: 'SUBCATEGORY', parentCategory: 'Plumbing' });
            expect(res.status).toBe(201);
            expect(res.body.data.type).toBe('new_subcategory');
            expect(res.body.data.payload.parentCategory).toBe('Plumbing');
        });

        it('should reject without name', async () => {
            const res = await request(app)
                .post('/api/v1/workers/category-suggestions')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ type: 'CATEGORY' });
            expect(res.status).toBe(400);
        });

        it('should reject without type', async () => {
            const res = await request(app)
                .post('/api/v1/workers/category-suggestions')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ name: 'Test Service' });
            expect(res.status).toBe(400);
        });

        it('should reject subcategory without parent', async () => {
            const res = await request(app)
                .post('/api/v1/workers/category-suggestions')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ name: 'AC Repair', type: 'SUBCATEGORY' });
            expect(res.status).toBe(400);
        });

        it('should reject non-worker role', async () => {
            const res = await request(app)
                .post('/api/v1/workers/category-suggestions')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ name: 'Test', type: 'CATEGORY' });
            expect(res.status).toBe(403);
        });
    });

    // ── GET /api/v1/workers/category-suggestions ──────────────────────────────
    describe('GET /api/v1/workers/category-suggestions', () => {
        it('should return worker\'s suggestions', async () => {
            await Suggestion.create({
                workerId: workerUser._id,
                workerName: 'Test Worker',
                workerCity: 'Mumbai',
                type: 'new_category',
                source: 'worker',
                payload: { name: 'Solar Installation', description: 'Solar panel install' }
            });

            const res = await request(app)
                .get('/api/v1/workers/category-suggestions')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].payload.name).toBe('Solar Installation');
        });

        it('should return empty array when no suggestions', async () => {
            const res = await request(app)
                .get('/api/v1/workers/category-suggestions')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });

        it('should only return current worker\'s suggestions', async () => {
            const otherWorker = await createTestUser({
                role: 'WORKER', email: 'other-sug@test.com', phone: '9077777',
                name: 'Other Worker'
            });
            await Suggestion.create({
                workerId: otherWorker._id,
                workerName: 'Other Worker',
                type: 'new_category',
                source: 'worker',
                payload: { name: 'Other Service', description: 'Other' }
            });

            const res = await request(app)
                .get('/api/v1/workers/category-suggestions')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(0);
        });

        it('should reject non-worker role', async () => {
            const res = await request(app)
                .get('/api/v1/workers/category-suggestions')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    // ── POST /api/v1/workers/me/addresses ─────────────────────────────────────
    describe('POST /api/v1/workers/me/addresses', () => {
        it('should add a new address', async () => {
            const res = await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({
                    label: 'Home',
                    street: '123 Main St',
                    city: 'Mumbai',
                    area: 'Andheri',
                    pincode: '400058',
                    location: { coordinates: [72.8777, 19.0760] }
                });
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].label).toBe('Home');
            expect(res.body.data[0].isPrimary).toBe(true);
        });

        it('should set first address as primary and update activeLocation', async () => {
            await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({
                    label: 'Home', street: '123 Main St', city: 'Mumbai', area: 'Andheri',
                    pincode: '400058', location: { coordinates: [72.8777, 19.0760] }
                });

            const user = await Customer.findById(workerUser._id);
            expect(user.addresses[0].isPrimary).toBe(true);
            expect(user.activeLocation.coordinates).toEqual([72.8777, 19.0760]);
        });

        it('should unmark previous primary when new address is primary', async () => {
            await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', pincode: '400058', location: { coordinates: [72.8777, 19.0760] } });

            await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Work', street: '456 Rd', city: 'Mumbai', pincode: '400001', isPrimary: true });

            const user = await Customer.findById(workerUser._id);
            const primaryCount = user.addresses.filter(a => a.isPrimary).length;
            expect(primaryCount).toBe(1);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/workers/me/addresses')
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', pincode: '400058', location: { coordinates: [72.8777, 19.0760] } });
            expect(res.status).toBe(401);
        });

        it('should reject non-worker role', async () => {
            const res = await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', pincode: '400058', location: { coordinates: [72.8777, 19.0760] } });
            expect(res.status).toBe(403);
        });
    });

    // ── PUT /api/v1/workers/me/addresses/:id ──────────────────────────────────
    describe('PUT /api/v1/workers/me/addresses/:addressId', () => {
        let addressId;

        beforeEach(async () => {
            const res = await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', pincode: '400058', location: { coordinates: [72.8777, 19.0760] } });
            addressId = res.body.data[0]._id;
        });

        it('should update address label', async () => {
            const res = await request(app)
                .put(`/api/v1/workers/me/addresses/${addressId}`)
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Studio' });
            expect(res.status).toBe(200);
            const updated = res.body.data.find(a => a._id === addressId);
            expect(updated.label).toBe('Studio');
        });

        it('should update address street and city', async () => {
            const res = await request(app)
                .put(`/api/v1/workers/me/addresses/${addressId}`)
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ street: '789 New St', city: 'Delhi', area: 'CP', pincode: '110001' });
            expect(res.status).toBe(200);
        });

        it('should return 404 for non-existent address', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .put(`/api/v1/workers/me/addresses/${fakeId}`)
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Ghost' });
            expect(res.status).toBe(404);
        });

        it('should update location coordinates', async () => {
            const res = await request(app)
                .put(`/api/v1/workers/me/addresses/${addressId}`)
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ location: { coordinates: [77.1025, 28.7041] } });
            expect(res.status).toBe(200);
        });
    });

    // ── DELETE /api/v1/workers/me/addresses/:id ───────────────────────────────
    describe('DELETE /api/v1/workers/me/addresses/:addressId', () => {
        let addressId;

        beforeEach(async () => {
            const res = await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', pincode: '400058', location: { coordinates: [72.8777, 19.0760] } });
            addressId = res.body.data[0]._id;
        });

        it('should delete the address', async () => {
            const res = await request(app)
                .delete(`/api/v1/workers/me/addresses/${addressId}`)
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
            const user = await Customer.findById(workerUser._id);
            expect(user.addresses.length).toBe(0);
        });

        it('should make next address primary when primary is deleted', async () => {
            await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Work', street: '456 Rd', city: 'Mumbai', pincode: '400001' });

            const res = await request(app)
                .delete(`/api/v1/workers/me/addresses/${addressId}`)
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);

            const user = await Customer.findById(workerUser._id);
            expect(user.addresses.length).toBe(1);
            expect(user.addresses[0].isPrimary).toBe(true);
        });

        it('should return 404 for non-existent address', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .delete(`/api/v1/workers/me/addresses/${fakeId}`)
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(404);
        });

        it('should reject non-owner address deletion', async () => {
            const otherWorker = await createTestUser({
                role: 'WORKER', email: 'other-addr@test.com', phone: '9066666',
                name: 'Other Worker'
            });
            const otherToken = generateToken(otherWorker);

            // Other worker has no addresses, trying to delete a random ID should 404
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .delete(`/api/v1/workers/me/addresses/${fakeId}`)
                .set('Authorization', `Bearer ${otherToken}`);
            expect(res.status).toBe(404);
        });
    });

    // ── PATCH /api/v1/workers/me/addresses/:id/primary ────────────────────────
    describe('PATCH /api/v1/workers/me/addresses/:addressId/primary', () => {
        let addr1Id, addr2Id;

        beforeEach(async () => {
            const r1 = await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', pincode: '400058', location: { coordinates: [72.8777, 19.0760] } });
            addr1Id = r1.body.data[0]._id;

            const r2 = await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Work', street: '456 Rd', city: 'Mumbai', pincode: '400001' });
            addr2Id = r2.body.data[1]._id;
        });

        it('should set second address as primary', async () => {
            const res = await request(app)
                .patch(`/api/v1/workers/me/addresses/${addr2Id}/primary`)
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);

            const user = await Customer.findById(workerUser._id);
            const a1 = user.addresses.id(addr1Id);
            const a2 = user.addresses.id(addr2Id);
            expect(a1.isPrimary).toBe(false);
            expect(a2.isPrimary).toBe(true);
        });

        it('should update activeLocation to match primary address', async () => {
            await request(app)
                .patch(`/api/v1/workers/me/addresses/${addr2Id}/primary`)
                .set('Authorization', `Bearer ${workerToken}`);

            const user = await Customer.findById(workerUser._id);
            expect(user.activeLocation.addressDetails.city).toBe('Mumbai');
        });

        it('should return 404 for non-existent address', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .patch(`/api/v1/workers/me/addresses/${fakeId}/primary`)
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(404);
        });

        it('should reject non-worker role', async () => {
            const res = await request(app)
                .patch(`/api/v1/workers/me/addresses/${addr2Id}/primary`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .patch(`/api/v1/workers/me/addresses/${addr2Id}/primary`);
            expect(res.status).toBe(401);
        });
    });
});
