const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Customer = require('../modules/customer/customer.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Worker Address CRUD', () => {
    let workerToken, workerId, customerToken;

    beforeEach(async () => {
        const worker = await createTestUser({
            role: 'WORKER',
            email: 'addrworker@test.com',
            phone: '1234567890',
            addresses: []
        });
        workerToken = generateToken(worker);
        workerId = worker._id;

        const customer = await createTestUser({ role: 'CUSTOMER', email: 'addrcustomer@test.com', phone: '1234567891' });
        customerToken = generateToken(customer);
    });

    describe('POST /api/v1/workers/me/addresses', () => {
        it('should add a new address', async () => {
            const res = await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({
                    label: 'Home',
                    street: '123 Main Street',
                    city: 'Mumbai',
                    area: 'Andheri',
                    pincode: '400058',
                    isPrimary: true,
                    location: { coordinates: [72.8777, 19.0760] }
                });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].label).toBe('Home');
            expect(res.body.data[0].isPrimary).toBe(true);
        });

        it('should set first address as primary automatically', async () => {
            const res = await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({
                    label: 'Office',
                    street: '456 Work Avenue',
                    city: 'Mumbai',
                    area: 'Bandra',
                    pincode: '400051'
                });

            expect(res.status).toBe(200);
            expect(res.body.data[0].isPrimary).toBe(true);
        });

        it('should unset other primary when adding new primary', async () => {
            // Add first address
            await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', area: 'Andheri', pincode: '400058', isPrimary: true });

            // Add second address as primary
            const res = await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Office', street: '456 Work Ave', city: 'Mumbai', area: 'Bandra', pincode: '400051', isPrimary: true });

            expect(res.status).toBe(200);
            const primaryCount = res.body.data.filter(a => a.isPrimary).length;
            expect(primaryCount).toBe(1);
            expect(res.body.data.find(a => a.label === 'Office').isPrimary).toBe(true);
        });

        it('should reject non-worker from adding address', async () => {
            const res = await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', area: 'Andheri', pincode: '400058' });

            expect(res.status).toBe(403);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/workers/me/addresses')
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', area: 'Andheri', pincode: '400058' });

            expect(res.status).toBe(401);
        });
    });

    describe('PUT /api/v1/workers/me/addresses/:id', () => {
        it('should update an existing address', async () => {
            // Add an address first
            const addRes = await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', area: 'Andheri', pincode: '400058' });

            const addressId = addRes.body.data[0]._id;

            const res = await request(app)
                .put(`/api/v1/workers/me/addresses/${addressId}`)
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Updated Home', street: '789 New Street', pincode: '400060' });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            const updated = res.body.data.find(a => a._id === addressId);
            expect(updated.label).toBe('Updated Home');
            expect(updated.pincode).toBe('400060');
        });

        it('should return 404 for non-existent address', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .put(`/api/v1/workers/me/addresses/${fakeId}`)
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Test' });

            expect(res.status).toBe(404);
        });

        it('should reject non-worker from updating address', async () => {
            const addRes = await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', area: 'Andheri', pincode: '400058' });

            const addressId = addRes.body.data[0]._id;

            const res = await request(app)
                .put(`/api/v1/workers/me/addresses/${addressId}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ label: 'Hacked' });

            expect(res.status).toBe(403);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .put('/api/v1/workers/me/addresses/507f1f77bcf86cd799439011')
                .send({ label: 'Test' });

            expect(res.status).toBe(401);
        });
    });

    describe('DELETE /api/v1/workers/me/addresses/:id', () => {
        it('should delete an address', async () => {
            const addRes = await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', area: 'Andheri', pincode: '400058' });

            const addressId = addRes.body.data[0]._id;

            const res = await request(app)
                .delete(`/api/v1/workers/me/addresses/${addressId}`)
                .set('Authorization', `Bearer ${workerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.length).toBe(0);
        });

        it('should return 404 for non-existent address', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .delete(`/api/v1/workers/me/addresses/${fakeId}`)
                .set('Authorization', `Bearer ${workerToken}`);

            expect(res.status).toBe(404);
        });

        it('should promote next address to primary when deleting primary', async () => {
            // Add two addresses
            await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', area: 'Andheri', pincode: '400058', isPrimary: true });

            const add2Res = await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Office', street: '456 Work Ave', city: 'Mumbai', area: 'Bandra', pincode: '400051' });

            const primaryId = (await request(app).get('/api/v1/workers/me').set('Authorization', `Bearer ${workerToken}`)).body.data.addresses.find(a => a.label === 'Home')._id;

            const res = await request(app)
                .delete(`/api/v1/workers/me/addresses/${primaryId}`)
                .set('Authorization', `Bearer ${workerToken}`);

            expect(res.status).toBe(200);
            const remainingPrimary = res.body.data.find(a => a.isPrimary === true);
            expect(remainingPrimary).toBeDefined();
            expect(remainingPrimary.label).toBe('Office');
        });

        it('should reject non-worker from deleting address', async () => {
            const addRes = await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', area: 'Andheri', pincode: '400058' });

            const addressId = addRes.body.data[0]._id;

            const res = await request(app)
                .delete(`/api/v1/workers/me/addresses/${addressId}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(403);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .delete('/api/v1/workers/me/addresses/507f1f77bcf86cd799439011');

            expect(res.status).toBe(401);
        });
    });

    describe('PATCH /api/v1/workers/me/addresses/:id/primary', () => {
        it('should set an address as primary', async () => {
            // Add two addresses
            await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', area: 'Andheri', pincode: '400058', isPrimary: true });

            const add2Res = await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Office', street: '456 Work Ave', city: 'Mumbai', area: 'Bandra', pincode: '400051' });

            const officeId = add2Res.body.data.find(a => a.label === 'Office')._id;

            const res = await request(app)
                .patch(`/api/v1/workers/me/addresses/${officeId}/primary`)
                .set('Authorization', `Bearer ${workerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');

            const updated = res.body.data.find(a => a._id === officeId);
            expect(updated.isPrimary).toBe(true);

            // Only one should be primary
            const primaryCount = res.body.data.filter(a => a.isPrimary).length;
            expect(primaryCount).toBe(1);
        });

        it('should return 404 for non-existent address', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .patch(`/api/v1/workers/me/addresses/${fakeId}/primary`)
                .set('Authorization', `Bearer ${workerToken}`);

            expect(res.status).toBe(404);
        });

        it('should reject non-worker from setting primary', async () => {
            const addRes = await request(app)
                .post('/api/v1/workers/me/addresses')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ label: 'Home', street: '123 Main St', city: 'Mumbai', area: 'Andheri', pincode: '400058' });

            const addressId = addRes.body.data[0]._id;

            const res = await request(app)
                .patch(`/api/v1/workers/me/addresses/${addressId}/primary`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(403);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .patch('/api/v1/workers/me/addresses/507f1f77bcf86cd799439011/primary');

            expect(res.status).toBe(401);
        });
    });
});
