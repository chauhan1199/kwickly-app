const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Customer Management End-to-End', () => {
    let adminToken, customerToken;

    beforeEach(async () => {
        const admin = await createTestUser({ role: 'ADMIN', email: 'admin@e2e.com', phone: '9000000001' });
        adminToken = generateToken(admin);

        const customer = await createTestUser({ role: 'CUSTOMER', email: 'customer@e2e.com', phone: '9000000002', name: 'Test Customer' });
        customerToken = generateToken(customer);
    });

    // ─── 1. List Customers ─────────────────────────────────────────────────────
    describe('1. GET /api/v1/admin/customers — List Customers', () => {
        it('should return list of customers for admin', async () => {
            await createTestUser({ role: 'CUSTOMER', email: 'extra@test.com', phone: '9000000010', name: 'Extra Customer' });

            const res = await request(app)
                .get('/api/v1/admin/customers')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.customers).toBeDefined();
            expect(Array.isArray(res.body.data.customers)).toBe(true);
            expect(res.body.data.customers.length).toBeGreaterThanOrEqual(2);
        });

        it('should reject non-admin', async () => {
            const res = await request(app)
                .get('/api/v1/admin/customers')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app).get('/api/v1/admin/customers');
            expect(res.status).toBe(401);
        });
    });

    // ─── 2. Create Customer ────────────────────────────────────────────────────
    describe('2. POST /api/v1/admin/users — Create Customer', () => {
        it('should create a new customer', async () => {
            const res = await request(app)
                .post('/api/v1/admin/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'New Customer',
                    phone: '9000000003',
                    email: 'newcustomer@test.com',
                    role: 'CUSTOMER',
                    city: 'Ahmedabad',
                    bio: 'Test bio'
                });

            expect(res.status).toBe(201);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.name).toBe('New Customer');
            expect(res.body.data.phone).toBe('9000000003');
            expect(res.body.data.role).toBe('CUSTOMER');
        });

        it('should create customer with address', async () => {
            const res = await request(app)
                .post('/api/v1/admin/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Customer With Address',
                    phone: '9000000004',
                    role: 'CUSTOMER',
                    address: {
                        label: 'Home',
                        street: '123 Main St',
                        area: 'Downtown',
                        city: 'Mumbai',
                        pincode: '400001'
                    }
                });

            expect(res.status).toBe(201);
            expect(res.body.data.name).toBe('Customer With Address');
        });

        it('should reject duplicate phone number', async () => {
            await createTestUser({ role: 'CUSTOMER', email: 'dup@test.com', phone: '9000000005' });

            const res = await request(app)
                .post('/api/v1/admin/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Dup Customer', phone: '9000000005', role: 'CUSTOMER' });

            expect(res.status).toBe(400);
        });

        it('should reject missing required fields', async () => {
            const res = await request(app)
                .post('/api/v1/admin/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ role: 'CUSTOMER' });

            expect(res.status).toBe(400);
        });
    });

    // ─── 3. Get Customer Detail ────────────────────────────────────────────────
    describe('3. GET /api/v1/admin/customers/:id — Get Customer Detail', () => {
        it('should return customer detail', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'detail@test.com', phone: '9000000006', name: 'Detail Customer' });

            const res = await request(app)
                .get(`/api/v1/admin/customers/${customer._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
        });

        it('should return 400 for invalid ID', async () => {
            const res = await request(app)
                .get('/api/v1/admin/customers/invalidid123')
                .set('Authorization', `Bearer ${adminToken}`);

            expect([400, 404, 500]).toContain(res.status);
        });
    });

    // ─── 4. Update Customer ────────────────────────────────────────────────────
    describe('4. PATCH /api/v1/admin/users/:id — Update Customer', () => {
        it('should update customer name', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'update@test.com', phone: '9000000007', name: 'Old Name' });

            const res = await request(app)
                .patch(`/api/v1/admin/users/${customer._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Updated Name' });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Updated Name');
        });

        it('should update customer address', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'addr@test.com', phone: '9000000008', name: 'Addr Customer' });

            const res = await request(app)
                .patch(`/api/v1/admin/users/${customer._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    address: {
                        label: 'Office',
                        street: '456 Business Rd',
                        area: 'CBD',
                        city: 'Delhi',
                        pincode: '110001'
                    }
                });

            expect(res.status).toBe(200);
        });

        it('should update customer profile image', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'img@test.com', phone: '9000000009', name: 'Image Customer' });

            const res = await request(app)
                .patch(`/api/v1/admin/users/${customer._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ profileImage: 'https://example.com/avatar.jpg' });

            expect(res.status).toBe(200);
            expect(res.body.data.profileImage).toBe('https://example.com/avatar.jpg');
        });

        it('should reject update for non-existent user', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .patch(`/api/v1/admin/users/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Ghost' });

            expect(res.status).toBe(404);
        });
    });

    // ─── 5. Toggle Customer Status ─────────────────────────────────────────────
    describe('5. PATCH /api/v1/admin/users/:id/toggle-status — Toggle Status', () => {
        it('should deactivate an active customer', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'toggle@test.com', phone: '9000000011', name: 'Toggle Customer', isVerified: true });

            const res = await request(app)
                .patch(`/api/v1/admin/users/${customer._id}/toggle-status`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.isVerified).toBe(false);
        });

        it('should activate an inactive customer', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'toggle2@test.com', phone: '9000000012', name: 'Inactive Customer', isVerified: false });

            const res = await request(app)
                .patch(`/api/v1/admin/users/${customer._id}/toggle-status`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.isVerified).toBe(true);
        });

        it('should reject toggle for non-existent user', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .patch(`/api/v1/admin/users/${fakeId}/toggle-status`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });
    });

    // ─── 6. Delete Customer ────────────────────────────────────────────────────
    describe('6. DELETE /api/v1/admin/users/:id — Delete Customer', () => {
        it('should delete a customer', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'delete@test.com', phone: '9000000013', name: 'Delete Customer' });

            const res = await request(app)
                .delete(`/api/v1/admin/users/${customer._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);

            // Verify deleted
            const check = await request(app)
                .get(`/api/v1/admin/customers/${customer._id}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(check.status).not.toBe(200);
        });

        it('should reject delete for non-existent user', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .delete(`/api/v1/admin/users/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });
    });

    // ─── 7. Impersonate Customer ───────────────────────────────────────────────
    describe('7. POST /api/v1/admin/users/:id/impersonate — Impersonate', () => {
        it('should generate impersonation token', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'imp@test.com', phone: '9000000014', name: 'Imp Customer' });

            const res = await request(app)
                .post(`/api/v1/admin/users/${customer._id}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.token).toBeDefined();
            expect(typeof res.body.data.token).toBe('string');
            expect(res.body.data.token.length).toBeGreaterThan(10);
        });

        it('should reject impersonation for non-existent user', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .post(`/api/v1/admin/users/${fakeId}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });
    });

    // ─── 8. Customer Jobs (Admin-managed) ──────────────────────────────────────
    describe('8. GET /api/v1/admin/customers/:id/jobs — Customer Jobs', () => {
        it('should return empty jobs list for customer with no jobs', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'nojobs@test.com', phone: '9000000015', name: 'No Jobs Customer' });

            const res = await request(app)
                .get(`/api/v1/admin/customers/${customer._id}/jobs`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.jobs).toBeDefined();
            expect(Array.isArray(res.body.data.jobs)).toBe(true);
            expect(res.body.data.jobs.length).toBe(0);
        });

        it('should reject non-admin', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'cjobs@test.com', phone: '9000000016', name: 'C Jobs Customer' });

            const res = await request(app)
                .get(`/api/v1/admin/customers/${customer._id}/jobs`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(403);
        });
    });

    // ─── 9. Customer Orders (Admin-managed) ────────────────────────────────────
    describe('9. GET /api/v1/admin/customers/:id/orders — Customer Orders', () => {
        it('should return empty orders list for customer with no orders', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'noorders@test.com', phone: '9000000017', name: 'No Orders Customer' });

            const res = await request(app)
                .get(`/api/v1/admin/customers/${customer._id}/orders`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.orders).toBeDefined();
            expect(Array.isArray(res.body.data.orders)).toBe(true);
            expect(res.body.data.orders.length).toBe(0);
        });

        it('should reject non-admin', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'corders@test.com', phone: '9000000018', name: 'C Orders Customer' });

            const res = await request(app)
                .get(`/api/v1/admin/customers/${customer._id}/orders`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(403);
        });
    });

    // ─── 10. Wallet Management (Admin credit/debit) ────────────────────────────
    describe('10. POST /api/v1/wallet/adjust — Admin Wallet Adjust', () => {
        let adminWallet;

        beforeEach(async () => {
            // Fund admin wallet first so credits to customer wallets work
            const { AdminWallet } = require('../modules/adminWallet/adminWallet.model');
            adminWallet = await AdminWallet.findOne() || await AdminWallet.create({ balance: 0 });
            adminWallet.balance += 50000;
            await adminWallet.save();
        });

        it('should credit customer wallet', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'wallet@test.com', phone: '9000000019', name: 'Wallet Customer' });

            const res = await request(app)
                .post('/api/v1/wallet/adjust')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    userId: customer._id,
                    amount: 500,
                    type: 'ADJUSTMENT',
                    description: 'Admin credit bonus'
                });

            expect(res.status).toBe(200);
        });

        it('should reject non-admin wallet adjust', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'wallet2@test.com', phone: '9000000020', name: 'Wallet2 Customer' });

            const res = await request(app)
                .post('/api/v1/wallet/adjust')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    userId: customer._id,
                    amount: 500,
                    type: 'ADJUSTMENT'
                });

            expect(res.status).toBe(403);
        });

        it('should debit customer wallet with sufficient balance', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'wallet3@test.com', phone: '9000000021', name: 'Wallet3 Customer' });

            // First credit (takes from admin wallet)
            await request(app)
                .post('/api/v1/wallet/adjust')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ userId: customer._id, amount: 1000, type: 'ADJUSTMENT', description: 'Initial credit' });

            // Then debit (returns to admin wallet)
            const res = await request(app)
                .post('/api/v1/wallet/adjust')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ userId: customer._id, amount: 300, type: 'ADJUSTMENT', debit: true, description: 'Admin debit' });

            expect(res.status).toBe(200);
        });

        it('should reject debit with insufficient balance', async () => {
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'wallet4@test.com', phone: '9000000022', name: 'Wallet4 Customer' });

            const res = await request(app)
                .post('/api/v1/wallet/adjust')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ userId: customer._id, amount: 99999, type: 'ADJUSTMENT', debit: true });

            expect(res.status).toBe(402);
        });

        it('should reject adjust for non-existent user', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .post('/api/v1/wallet/adjust')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ userId: fakeId, amount: 100, type: 'ADJUSTMENT' });

            expect(res.status).toBe(404);
        });
    });

    // ─── 11. Notifications Broadcast ───────────────────────────────────────────
    describe('11. POST /api/v1/notifications/broadcast — Broadcast Notifications', () => {
        it('should send broadcast notification as admin', async () => {
            const res = await request(app)
                .post('/api/v1/notifications/broadcast')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    title: 'Customer Created',
                    message: 'Admin created a new customer account',
                    targetRole: 'CUSTOMER'
                });

            expect([200, 201]).toContain(res.status);
        });

        it('should reject non-admin broadcast', async () => {
            const res = await request(app)
                .post('/api/v1/notifications/broadcast')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ title: 'Test', message: 'Test broadcast' });

            expect(res.status).toBe(403);
        });
    });

    // ─── 12. Admin Activity Logs ───────────────────────────────────────────────
    describe('12. GET /api/v1/notifications/activity-logs — Activity Logs', () => {
        it('should return activity logs after customer operations', async () => {
            // Create a customer to generate activity
            const customer = await createTestUser({ role: 'CUSTOMER', email: 'log@test.com', phone: '9000000023', name: 'Log Customer' });

            // Update to generate log
            await request(app)
                .patch(`/api/v1/admin/users/${customer._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Log Customer Updated' });

            const res = await request(app)
                .get('/api/v1/notifications/activity-logs')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
        });

        it('should reject non-admin activity logs', async () => {
            const res = await request(app)
                .get('/api/v1/notifications/activity-logs')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(403);
        });
    });

    // ─── 13. Full CRUD Lifecycle ───────────────────────────────────────────────
    describe('13. Full CRUD Lifecycle — Create → Read → Update → Toggle → Delete', () => {
        it('should complete full lifecycle successfully', async () => {
            // Fund admin wallet for wallet credit/debit operations
            const { AdminWallet } = require('../modules/adminWallet/adminWallet.model');
            let adminW = await AdminWallet.findOne() || await AdminWallet.create({ balance: 0 });
            adminW.balance += 50000;
            await adminW.save();

            // CREATE
            const createRes = await request(app)
                .post('/api/v1/admin/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Lifecycle Customer',
                    phone: '9000000024',
                    email: 'lifecycle@test.com',
                    role: 'CUSTOMER',
                    city: 'Pune'
                });

            expect(createRes.status).toBe(201);
            const userId = createRes.body.data._id;
            expect(userId).toBeDefined();

            // READ
            const readRes = await request(app)
                .get(`/api/v1/admin/customers/${userId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(readRes.status).toBe(200);

            // UPDATE
            const updateRes = await request(app)
                .patch(`/api/v1/admin/users/${userId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Updated Lifecycle', city: 'Bangalore' });

            expect(updateRes.status).toBe(200);
            expect(updateRes.body.data.name).toBe('Updated Lifecycle');

            // TOGGLE (deactivate)
            const toggleRes = await request(app)
                .patch(`/api/v1/admin/users/${userId}/toggle-status`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(toggleRes.status).toBe(200);
            expect(toggleRes.body.data.isVerified).toBe(false);

            // TOGGLE (activate back)
            const toggleBack = await request(app)
                .patch(`/api/v1/admin/users/${userId}/toggle-status`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(toggleBack.status).toBe(200);
            expect(toggleBack.body.data.isVerified).toBe(true);

            // WALLET CREDIT
            const creditRes = await request(app)
                .post('/api/v1/wallet/adjust')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ userId, amount: 750, type: 'ADJUSTMENT', description: 'Test credit' });

            expect(creditRes.status).toBe(200);

            // WALLET DEBIT
            const debitRes = await request(app)
                .post('/api/v1/wallet/adjust')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ userId, amount: 250, type: 'ADJUSTMENT', debit: true, description: 'Test debit' });

            expect(debitRes.status).toBe(200);

            // JOBS (empty list)
            const jobsRes = await request(app)
                .get(`/api/v1/admin/customers/${userId}/jobs`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(jobsRes.status).toBe(200);
            expect(jobsRes.body.data.jobs.length).toBe(0);

            // ORDERS (empty list)
            const ordersRes = await request(app)
                .get(`/api/v1/admin/customers/${userId}/orders`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(ordersRes.status).toBe(200);
            expect(ordersRes.body.data.orders.length).toBe(0);

            // IMPERSONATE
            const impRes = await request(app)
                .post(`/api/v1/admin/users/${userId}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(impRes.status).toBe(200);
            expect(impRes.body.data.token).toBeDefined();

            // DELETE
            const deleteRes = await request(app)
                .delete(`/api/v1/admin/users/${userId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(deleteRes.status).toBe(200);

            // VERIFY DELETED
            const verifyRes = await request(app)
                .get(`/api/v1/admin/customers/${userId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(verifyRes.status).not.toBe(200);
        });
    });

    // ─── 14. Authorization Checks ──────────────────────────────────────────────
    describe('14. Authorization — All endpoints require admin role', () => {
        const endpoints = [
            { method: 'get', path: '/api/v1/admin/customers' },
            { method: 'post', path: '/api/v1/admin/users' },
            { method: 'patch', path: '/api/v1/admin/users/507f1f77bcf86cd799439011/toggle-status' },
            { method: 'delete', path: '/api/v1/admin/users/507f1f77bcf86cd799439011' },
            { method: 'get', path: '/api/v1/notifications/activity-logs' },
        ];

        endpoints.forEach(({ method, path }) => {
            it(`should reject ${method.toUpperCase()} ${path} for non-admin`, async () => {
                const res = await request(app)[method](path)
                    .set('Authorization', `Bearer ${customerToken}`);

                expect(res.status).toBe(403);
            });
        });
    });

    // ─── 15. Export Endpoints ──────────────────────────────────────────────────
    describe('15. Export Customers', () => {
        it('should export customers data', async () => {
            const res = await request(app)
                .get('/api/v1/admin/customers/export')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
        });

        it('should reject non-admin export', async () => {
            const res = await request(app)
                .get('/api/v1/admin/customers/export')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(403);
        });
    });
});
