const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Customer = require('../modules/customer/customer.model');
const Dispute = require('../modules/dispute/dispute.model');
const Job = require('../modules/job/job.model');
const Suggestion = require('../modules/suggestion/suggestion.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Customer Self-Service', () => {
    let customerToken, workerToken, customerUser, workerUser;

    beforeEach(async () => {
        const uid = Date.now().toString(36).slice(-6);
        customerUser = await createTestUser({
            role: 'CUSTOMER', email: `css-c-${uid}@test.com`, phone: `7000${uid}`,
            name: 'Test Customer', city: 'Mumbai',
            notificationPreferences: { jobUpdates: true, promotions: true },
            addresses: []
        });
        customerToken = generateToken(customerUser);

        workerUser = await createTestUser({
            role: 'WORKER', email: `css-w-${uid}@test.com`, phone: `7001${uid}`,
            name: 'Test Worker', city: 'Mumbai',
            activeLocation: { type: 'Point', coordinates: [72.8777, 19.0760] },
            kyc: { status: 'APPROVED', documents: [] },
            isVerified: true
        });
        workerToken = generateToken(workerUser);
    });

    // ── PUT /api/v1/customers/me/profile ──────────────────────────────────────
    describe('PUT /api/v1/customers/me/profile', () => {
        it('should update customer name', async () => {
            const res = await request(app)
                .put('/api/v1/customers/me/profile')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ name: 'Updated Name' });
            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Updated Name');
        });

        it('should update customer email', async () => {
            const res = await request(app)
                .put('/api/v1/customers/me/profile')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ email: 'newemail@test.com' });
            expect(res.status).toBe(200);
            expect(res.body.data.email).toBe('newemail@test.com');
        });

        it('should return 400 when no data provided', async () => {
            const res = await request(app)
                .put('/api/v1/customers/me/profile')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({});
            expect(res.status).toBe(400);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .put('/api/v1/customers/me/profile')
                .send({ name: 'Hacker' });
            expect(res.status).toBe(401);
        });

        it('should reject non-customer role', async () => {
            const res = await request(app)
                .put('/api/v1/customers/me/profile')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ name: 'Not Allowed' });
            expect(res.status).toBe(403);
        });

        it('should update wallet data as JSON string', async () => {
            const res = await request(app)
                .put('/api/v1/customers/me/profile')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    wallet: JSON.stringify({
                        bankDetails: { accountNumber: '1234567890', ifscCode: 'SBIN0001', bankName: 'SBI' },
                        upiId: 'test@upi'
                    })
                });
            expect(res.status).toBe(200);
        });

        it('should return 400 for invalid wallet JSON', async () => {
            const res = await request(app)
                .put('/api/v1/customers/me/profile')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ wallet: 'not-valid-json' });
            expect(res.status).toBe(400);
        });
    });

    // ── DELETE /api/v1/customers/me/account ───────────────────────────────────
    describe('DELETE /api/v1/customers/me/account', () => {
        it('should soft-delete the account with correct password', async () => {
            const res = await request(app)
                .delete('/api/v1/customers/me/account')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ password: 'password123' });
            expect(res.status).toBe(200);

            const user = await Customer.findById(customerUser._id);
            expect(user.isDeleted).toBe(true);
            expect(user.deletedAt).toBeDefined();
            expect(user.isVerified).toBe(false);
        });

        it('should reject with incorrect password', async () => {
            const res = await request(app)
                .delete('/api/v1/customers/me/account')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ password: 'wrongpassword' });
            expect(res.status).toBe(401);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .delete('/api/v1/customers/me/account')
                .send({ password: 'password123' });
            expect(res.status).toBe(401);
        });

        it('should reject non-customer role', async () => {
            const res = await request(app)
                .delete('/api/v1/customers/me/account')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ password: 'password123' });
            expect(res.status).toBe(403);
        });
    });

    // ── POST /api/v1/customers/me/addresses ───────────────────────────────────
    describe('POST /api/v1/customers/me/addresses', () => {
        it('should add a new address', async () => {
            const res = await request(app)
                .post('/api/v1/customers/me/addresses')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    label: 'Home',
                    street: '123 Main St',
                    city: 'Mumbai',
                    pincode: '400001',
                    location: { type: 'Point', coordinates: [72.8777, 19.0760] }
                });
            expect(res.status).toBe(200);
            expect(res.body.data.addresses).toBeDefined();
            expect(res.body.data.addresses.length).toBe(1);
            expect(res.body.data.addresses[0].label).toBe('Home');
            expect(res.body.data.addresses[0].isPrimary).toBe(true);
        });

        it('should set first address as primary by default', async () => {
            await request(app)
                .post('/api/v1/customers/me/addresses')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', pincode: '400001' });

            const user = await Customer.findById(customerUser._id);
            expect(user.addresses[0].isPrimary).toBe(true);
        });

        it('should unmark previous primary when new address is primary', async () => {
            await request(app)
                .post('/api/v1/customers/me/addresses')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', pincode: '400001' });

            await request(app)
                .post('/api/v1/customers/me/addresses')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ label: 'Office', street: '456 Office Rd', city: 'Mumbai', pincode: '400002', isPrimary: true });

            const user = await Customer.findById(customerUser._id);
            const primaryCount = user.addresses.filter(a => a.isPrimary).length;
            expect(primaryCount).toBe(1);
            expect(user.addresses[1].isPrimary).toBe(true);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/customers/me/addresses')
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', pincode: '400001' });
            expect(res.status).toBe(401);
        });
    });

    // ── PUT /api/v1/customers/me/addresses/:id ────────────────────────────────
    describe('PUT /api/v1/customers/me/addresses/:addressId', () => {
        let addressId;

        beforeEach(async () => {
            const res = await request(app)
                .post('/api/v1/customers/me/addresses')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', pincode: '400001' });
            addressId = res.body.data.addresses[0]._id;
        });

        it('should update address label', async () => {
            const res = await request(app)
                .put(`/api/v1/customers/me/addresses/${addressId}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ label: 'Work' });
            expect(res.status).toBe(200);
            const user = await Customer.findById(customerUser._id);
            const updated = user.addresses.id(addressId);
            expect(updated.label).toBe('Work');
        });

        it('should update address street and city', async () => {
            const res = await request(app)
                .put(`/api/v1/customers/me/addresses/${addressId}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ street: '789 New St', city: 'Delhi' });
            expect(res.status).toBe(200);
            const user = await Customer.findById(customerUser._id);
            const updated = user.addresses.id(addressId);
            expect(updated.street).toBe('789 New St');
            expect(updated.city).toBe('Delhi');
        });

        it('should return 404 for non-existent address', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .put(`/api/v1/customers/me/addresses/${fakeId}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ label: 'Ghost' });
            expect(res.status).toBe(404);
        });

        it('should set address as primary', async () => {
            await request(app)
                .post('/api/v1/customers/me/addresses')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ label: 'Office', street: '456 Rd', city: 'Mumbai', pincode: '400002' });

            const secondAddr = (await Customer.findById(customerUser._id)).addresses[1];
            const res = await request(app)
                .put(`/api/v1/customers/me/addresses/${secondAddr._id}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ isPrimary: true });
            expect(res.status).toBe(200);

            const user = await Customer.findById(customerUser._id);
            const primaryCount = user.addresses.filter(a => a.isPrimary).length;
            expect(primaryCount).toBe(1);
        });
    });

    // ── DELETE /api/v1/customers/me/addresses/:id ─────────────────────────────
    describe('DELETE /api/v1/customers/me/addresses/:addressId', () => {
        let addressId;

        beforeEach(async () => {
            const res = await request(app)
                .post('/api/v1/customers/me/addresses')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', pincode: '400001' });
            addressId = res.body.data.addresses[0]._id;
        });

        it('should delete the address', async () => {
            const res = await request(app)
                .delete(`/api/v1/customers/me/addresses/${addressId}`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
            const user = await Customer.findById(customerUser._id);
            expect(user.addresses.length).toBe(0);
        });

        it('should make next address primary when primary is deleted', async () => {
            await request(app)
                .post('/api/v1/customers/me/addresses')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ label: 'Office', street: '456 Rd', city: 'Mumbai', pincode: '400002' });

            const res = await request(app)
                .delete(`/api/v1/customers/me/addresses/${addressId}`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);

            const user = await Customer.findById(customerUser._id);
            expect(user.addresses.length).toBe(1);
            expect(user.addresses[0].isPrimary).toBe(true);
        });

        it('should return 200 for non-existent address (pull is idempotent)', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .delete(`/api/v1/customers/me/addresses/${fakeId}`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
        });
    });

    // ── PATCH /api/v1/customers/me/addresses/:id/primary ──────────────────────
    describe('PATCH /api/v1/customers/me/addresses/:addressId/primary', () => {
        let addr1Id, addr2Id;

        beforeEach(async () => {
            const r1 = await request(app)
                .post('/api/v1/customers/me/addresses')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', pincode: '400001' });
            addr1Id = r1.body.data.addresses[0]._id;

            const r2 = await request(app)
                .post('/api/v1/customers/me/addresses')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ label: 'Office', street: '456 Rd', city: 'Mumbai', pincode: '400002' });
            addr2Id = r2.body.data.addresses[1]._id;
        });

        it('should set address as primary', async () => {
            const res = await request(app)
                .patch(`/api/v1/customers/me/addresses/${addr2Id}/primary`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);

            const user = await Customer.findById(customerUser._id);
            const a1 = user.addresses.id(addr1Id);
            const a2 = user.addresses.id(addr2Id);
            expect(a1.isPrimary).toBe(false);
            expect(a2.isPrimary).toBe(true);
        });

        it('should return 404 for non-existent address', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .patch(`/api/v1/customers/me/addresses/${fakeId}/primary`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(404);
        });

        it('should reject non-customer role', async () => {
            const res = await request(app)
                .patch(`/api/v1/customers/me/addresses/${addr2Id}/primary`)
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(403);
        });
    });

    // ── PUT /api/v1/customers/me/notifications ────────────────────────────────
    describe('PUT /api/v1/customers/me/notifications', () => {
        it('should update notification preferences', async () => {
            const res = await request(app)
                .put('/api/v1/customers/me/notifications')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ jobUpdates: false, promotions: false });
            expect(res.status).toBe(200);
            expect(res.body.data.notificationPreferences.jobUpdates).toBe(false);
            expect(res.body.data.notificationPreferences.promotions).toBe(false);
        });

        it('should enable only job updates', async () => {
            const res = await request(app)
                .put('/api/v1/customers/me/notifications')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ jobUpdates: true, promotions: false });
            expect(res.status).toBe(200);
            expect(res.body.data.notificationPreferences.jobUpdates).toBe(true);
            expect(res.body.data.notificationPreferences.promotions).toBe(false);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .put('/api/v1/customers/me/notifications')
                .send({ jobUpdates: true, promotions: true });
            expect(res.status).toBe(401);
        });
    });

    // ── POST /api/v1/customers/me/notifications/trigger ───────────────────────
    describe('POST /api/v1/customers/me/notifications/trigger', () => {
        it('should trigger a test notification', async () => {
            const res = await request(app)
                .post('/api/v1/customers/me/notifications/trigger')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ title: 'Test Notification', message: 'This is a test' });
            expect(res.status).toBe(200);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/customers/me/notifications/trigger')
                .send({ title: 'Test', message: 'Test msg' });
            expect(res.status).toBe(401);
        });

        it('should reject non-customer role', async () => {
            const res = await request(app)
                .post('/api/v1/customers/me/notifications/trigger')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ title: 'Test', message: 'Test msg' });
            expect(res.status).toBe(403);
        });
    });

    // ── GET /api/v1/customers/workers/:id/profile ────────────────────────────
    describe('GET /api/v1/customers/workers/:id/profile', () => {
        it('should return worker profile', async () => {
            const res = await request(app)
                .get(`/api/v1/customers/workers/${workerUser._id}/profile`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Test Worker');
        });

        it('should return completedJobs count', async () => {
            await Job.create({
                customerId: customerUser._id,
                workerId: workerUser._id,
                category: 'Plumbing',
                description: 'Fix pipe',
                status: 'COMPLETED',
                location: { type: 'Point', coordinates: [72.8777, 19.0760] },
                addressDetails: { city: 'Mumbai', fullAddress: '123 Main St' }
            });

            const res = await request(app)
                .get(`/api/v1/customers/workers/${workerUser._id}/profile`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.completedJobs).toBe(1);
        });

        it('should return 404 for non-existent worker', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .get(`/api/v1/customers/workers/${fakeId}/profile`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(404);
        });

        it('should return 404 when ID belongs to a non-worker', async () => {
            const res = await request(app)
                .get(`/api/v1/customers/workers/${customerUser._id}/profile`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(404);
        });
    });

    // ── POST /api/v1/customers/category-suggestions ──────────────────────────
    describe('POST /api/v1/customers/category-suggestions', () => {
        it('should submit a new category suggestion', async () => {
            const res = await request(app)
                .post('/api/v1/customers/category-suggestions')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ name: 'Pool Cleaning', type: 'new_category', description: 'Swimming pool services' });
            expect(res.status).toBe(201);
            expect(res.body.data.type).toBe('new_category');
            expect(res.body.data.source).toBe('customer');
        });

        it('should submit a subcategory suggestion', async () => {
            const res = await request(app)
                .post('/api/v1/customers/category-suggestions')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ name: 'AC Gas Refill', type: 'new_subcategory', parentCategory: 'AC Repair', description: 'AC gas top-up' });
            expect(res.status).toBe(201);
            expect(res.body.data.payload.parentCategory).toBe('AC Repair');
        });

        it('should reject without name', async () => {
            const res = await request(app)
                .post('/api/v1/customers/category-suggestions')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ type: 'new_category' });
            expect(res.status).toBe(400);
        });

        it('should reject subcategory without parent', async () => {
            const res = await request(app)
                .post('/api/v1/customers/category-suggestions')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ name: 'AC Gas Refill', type: 'new_subcategory' });
            expect(res.status).toBe(400);
        });
    });

    // ── POST /api/v1/customers/disputes ───────────────────────────────────────
    describe('POST /api/v1/customers/disputes', () => {
        it('should open a dispute with jobId', async () => {
            const job = await Job.create({
                customerId: customerUser._id,
                workerId: workerUser._id,
                category: 'Plumbing',
                description: 'Fix leaky pipe',
                status: 'COMPLETED',
                location: { type: 'Point', coordinates: [72.8777, 19.0760] },
                addressDetails: { city: 'Mumbai', fullAddress: '123 Main St' },
                payment: { amount: 500, platformFee: 50, workerPayout: 450, status: 'PAID' }
            });

            const res = await request(app)
                .post('/api/v1/customers/disputes')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    jobId: job._id.toString(),
                    reason: 'Incomplete work',
                    description: 'Worker did not fix the pipe',
                    issue: 'Leak still present'
                });
            expect(res.status).toBe(201);
            expect(res.body.data.status).toBe('open');
            expect(res.body.data.reason).toBe('Incomplete work');
        });

        it('should open a dispute without reason field failing validation', async () => {
            const res = await request(app)
                .post('/api/v1/customers/disputes')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ jobId: new mongoose.Types.ObjectId().toString() });
            expect(res.status).toBe(400);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/customers/disputes')
                .send({ reason: 'Test', jobId: new mongoose.Types.ObjectId().toString() });
            expect(res.status).toBe(401);
        });
    });
});
