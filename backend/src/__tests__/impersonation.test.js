const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Impersonation Flow End-to-End', () => {
    let adminToken, customer, customerId;

    beforeEach(async () => {
        const admin = await createTestUser({ role: 'ADMIN', email: 'imp-admin@test.com', phone: '8000000001' });
        adminToken = generateToken(admin);

        customer = await createTestUser({
            role: 'CUSTOMER',
            email: 'imp-customer@test.com',
            phone: '8000000002',
            name: 'Impersonate Target',
            city: 'Mumbai',
            isVerified: true,
            wallet: { balance: 500 }
        });
        customerId = customer._id;
    });

    // ─── 1. Generate Impersonation Token ──────────────────────────────────────
    describe('1. Generate Impersonation Token', () => {
        it('should generate a valid JWT token', async () => {
            const res = await request(app)
                .post(`/api/v1/admin/users/${customerId}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.token).toBeDefined();
            expect(typeof res.body.data.token).toBe('string');

            const decoded = jwt.verify(res.body.data.token, process.env.JWT_SECRET);
            expect(decoded.id).toBe(String(customerId));
            expect(decoded.role).toBe('CUSTOMER');
            expect(decoded.isImpersonated).toBe(true);
        });

        it('should return user info in response', async () => {
            const res = await request(app)
                .post(`/api/v1/admin/users/${customerId}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.user).toBeDefined();
            expect(res.body.data.user.name).toBe('Impersonate Target');
            expect(res.body.data.user.role).toBe('CUSTOMER');
        });

        it('should reject impersonation for non-existent user', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .post(`/api/v1/admin/users/${fakeId}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });

        it('should reject impersonation by non-admin', async () => {
            const customerToken = generateToken(customer);
            const res = await request(app)
                .post(`/api/v1/admin/users/${customerId}/impersonate`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(403);
        });

        it('should create an activity log entry', async () => {
            await request(app)
                .post(`/api/v1/admin/users/${customerId}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);

            const res = await request(app)
                .get('/api/v1/notifications/activity-logs')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            const logs = res.body.data?.logs || res.body.data || [];
            const impLog = logs.find(l => l.action === 'IMPERSONATE');
            expect(impLog).toBeDefined();
            expect(impLog.entityType).toBe('CUSTOMER');
        });
    });

    // ─── 2. Use Impersonation Token — Access Customer Profile ─────────────────
    describe('2. Access Customer Profile with Impersonation Token', () => {
        let impToken;

        beforeEach(async () => {
            const res = await request(app)
                .post(`/api/v1/admin/users/${customerId}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);
            impToken = res.body.data.token;
        });

        it('should access customer profile', async () => {
            const res = await request(app)
                .get('/api/v1/customers/me/profile')
                .set('Authorization', `Bearer ${impToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.name).toBe('Impersonate Target');
            expect(res.body.data.phone).toBe('8000000002');
            expect(res.body.data.email).toBe('imp-customer@test.com');
        });

        it('should see wallet balance', async () => {
            const res = await request(app)
                .get('/api/v1/customers/me/profile')
                .set('Authorization', `Bearer ${impToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.wallet).toBeDefined();
            expect(res.body.data.wallet.balance).toBe(500);
        });

        it('should see customer city', async () => {
            const res = await request(app)
                .get('/api/v1/customers/me/profile')
                .set('Authorization', `Bearer ${impToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.city).toBe('Mumbai');
        });
    });

    // ─── 3. Use Impersonation Token — Access Wallet ───────────────────────────
    describe('3. Access Wallet with Impersonation Token', () => {
        let impToken;

        beforeEach(async () => {
            const res = await request(app)
                .post(`/api/v1/admin/users/${customerId}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);
            impToken = res.body.data.token;
        });

        it('should access wallet balance', async () => {
            const res = await request(app)
                .get('/api/v1/wallet/balance')
                .set('Authorization', `Bearer ${impToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.balance).toBe(500);
        });
    });

    // ─── 4. Use Impersonation Token — Access Active Jobs ──────────────────────
    describe('4. Access Active Jobs with Impersonation Token', () => {
        let impToken;

        beforeEach(async () => {
            const res = await request(app)
                .post(`/api/v1/admin/users/${customerId}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);
            impToken = res.body.data.token;
        });

        it('should access active jobs endpoint', async () => {
            const res = await request(app)
                .get('/api/v1/customers/jobs/active')
                .set('Authorization', `Bearer ${impToken}`);

            expect(res.status).toBe(200);
        });
    });

    // ─── 5. Use Impersonation Token — Browse Workers ──────────────────────────
    describe('5. Browse Workers with Impersonation Token', () => {
        let impToken;

        beforeEach(async () => {
            const res = await request(app)
                .post(`/api/v1/admin/users/${customerId}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);
            impToken = res.body.data.token;
        });

        it('should access top pros endpoint', async () => {
            const res = await request(app)
                .get('/api/v1/customers/top-pros')
                .set('Authorization', `Bearer ${impToken}`);

            expect(res.status).toBe(200);
        });
    });

    // ─── 6. Impersonation Token Cannot Access Admin Endpoints ─────────────────
    describe('6. Impersonation Token Cannot Access Admin Endpoints', () => {
        let impToken;

        beforeEach(async () => {
            const res = await request(app)
                .post(`/api/v1/admin/users/${customerId}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);
            impToken = res.body.data.token;
        });

        it('should reject admin customers list', async () => {
            const res = await request(app)
                .get('/api/v1/admin/customers')
                .set('Authorization', `Bearer ${impToken}`);

            expect(res.status).toBe(403);
        });

        it('should reject admin stats', async () => {
            const res = await request(app)
                .get('/api/v1/admin/stats')
                .set('Authorization', `Bearer ${impToken}`);

            expect(res.status).toBe(403);
        });

        it('should reject admin activity logs', async () => {
            const res = await request(app)
                .get('/api/v1/notifications/activity-logs')
                .set('Authorization', `Bearer ${impToken}`);

            expect(res.status).toBe(403);
        });

        it('should reject creating users', async () => {
            const res = await request(app)
                .post('/api/v1/admin/users')
                .set('Authorization', `Bearer ${impToken}`)
                .send({ name: 'Hacker', phone: '9999999999', role: 'CUSTOMER' });

            expect(res.status).toBe(403);
        });
    });

    // ─── 7. Impersonation Token Cannot Access Other Customer Data ─────────────
    describe('7. Impersonation Token Is Scoped to Target Customer', () => {
        let impToken, otherCustomer, otherToken;

        beforeEach(async () => {
            otherCustomer = await createTestUser({
                role: 'CUSTOMER',
                email: 'other@test.com',
                phone: '8000000003',
                name: 'Other Customer',
                isVerified: true
            });
            otherToken = generateToken(otherCustomer);

            const res = await request(app)
                .post(`/api/v1/admin/users/${customerId}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);
            impToken = res.body.data.token;
        });

        it('should only see own profile, not other customer profile', async () => {
            const myProfile = await request(app)
                .get('/api/v1/customers/me/profile')
                .set('Authorization', `Bearer ${impToken}`);

            expect(myProfile.status).toBe(200);
            expect(myProfile.body.data.name).toBe('Impersonate Target');

            const otherProfile = await request(app)
                .get('/api/v1/customers/me/profile')
                .set('Authorization', `Bearer ${otherToken}`);

            expect(otherProfile.status).toBe(200);
            expect(otherProfile.body.data.name).toBe('Other Customer');
            expect(otherProfile.body.data._id).not.toBe(String(customerId));
        });

        it('should only see own wallet balance', async () => {
            const myWallet = await request(app)
                .get('/api/v1/wallet/balance')
                .set('Authorization', `Bearer ${impToken}`);

            expect(myWallet.status).toBe(200);
            expect(myWallet.body.data.balance).toBe(500);
        });
    });

    // ─── 8. Impersonation Token Cannot Modify Other Customer ──────────────────
    describe('8. Impersonation Token Cannot Modify Other Customer', () => {
        let impToken, otherCustomer;

        beforeEach(async () => {
            otherCustomer = await createTestUser({
                role: 'CUSTOMER',
                email: 'other2@test.com',
                phone: '8000000004',
                name: 'Victim Customer',
                isVerified: true
            });

            const res = await request(app)
                .post(`/api/v1/admin/users/${customerId}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);
            impToken = res.body.data.token;
        });

        it('should not be able to update another customer via admin endpoint', async () => {
            const res = await request(app)
                .patch(`/api/v1/admin/users/${otherCustomer._id}`)
                .set('Authorization', `Bearer ${impToken}`)
                .send({ name: 'Hacked Name' });

            expect(res.status).toBe(403);
        });

        it('should not be able to delete another customer', async () => {
            const res = await request(app)
                .delete(`/api/v1/admin/users/${otherCustomer._id}`)
                .set('Authorization', `Bearer ${impToken}`);

            expect(res.status).toBe(403);
        });

        it('should not be able to toggle another customer status', async () => {
            const res = await request(app)
                .patch(`/api/v1/admin/users/${otherCustomer._id}/toggle-status`)
                .set('Authorization', `Bearer ${impToken}`);

            expect(res.status).toBe(403);
        });
    });

    // ─── 9. Impersonation Token Expiry ────────────────────────────────────────
    describe('9. Impersonation Token Expiry', () => {
        it('should reject expired impersonation token', async () => {
            const expiredToken = jwt.sign(
                { id: customerId, role: 'CUSTOMER', isImpersonated: true },
                process.env.JWT_SECRET,
                { expiresIn: '0s' }
            );

            // Wait a moment for the token to expire
            await new Promise(r => setTimeout(r, 1100));

            const res = await request(app)
                .get('/api/v1/customers/me/profile')
                .set('Authorization', `Bearer ${expiredToken}`);

            expect(res.status).toBe(401);
        });
    });

    // ─── 10. Impersonation Token Cannot Create Jobs/Orders ────────────────────
    describe('10. Impersonation Token Cannot Access Admin Job/Order Endpoints', () => {
        let impToken;

        beforeEach(async () => {
            const res = await request(app)
                .post(`/api/v1/admin/users/${customerId}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);
            impToken = res.body.data.token;
        });

        it('should reject admin customer jobs endpoint', async () => {
            const res = await request(app)
                .get(`/api/v1/admin/customers/${customerId}/jobs`)
                .set('Authorization', `Bearer ${impToken}`);

            expect(res.status).toBe(403);
        });

        it('should reject admin customer orders endpoint', async () => {
            const res = await request(app)
                .get(`/api/v1/admin/customers/${customerId}/orders`)
                .set('Authorization', `Bearer ${impToken}`);

            expect(res.status).toBe(403);
        });

        it('should reject creating job on behalf of customer', async () => {
            const res = await request(app)
                .post(`/api/v1/admin/customers/${customerId}/jobs`)
                .set('Authorization', `Bearer ${impToken}`)
                .send({ customerId, category: 'Plumbing', description: 'Leaky faucet' });

            expect(res.status).toBe(403);
        });
    });

    // ─── 11. Multiple Impersonations ──────────────────────────────────────────
    describe('11. Multiple Impersonations', () => {
        it('should allow impersonating different customers sequentially', async () => {
            const customer2 = await createTestUser({
                role: 'CUSTOMER',
                email: 'imp2@test.com',
                phone: '8000000005',
                name: 'Second Target',
                isVerified: true
            });

            // Impersonate first customer
            const res1 = await request(app)
                .post(`/api/v1/admin/users/${customerId}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res1.status).toBe(200);
            const token1 = res1.body.data.token;

            // Impersonate second customer
            const res2 = await request(app)
                .post(`/api/v1/admin/users/${customer2._id}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res2.status).toBe(200);
            const token2 = res2.body.data.token;

            // Both tokens should work but see different profiles
            const profile1 = await request(app)
                .get('/api/v1/customers/me/profile')
                .set('Authorization', `Bearer ${token1}`);
            expect(profile1.body.data.name).toBe('Impersonate Target');

            const profile2 = await request(app)
                .get('/api/v1/customers/me/profile')
                .set('Authorization', `Bearer ${token2}`);
            expect(profile2.body.data.name).toBe('Second Target');
        });
    });

    // ─── 12. Impersonation with Deactivated Customer ──────────────────────────
    describe('12. Impersonation with Deactivated Customer', () => {
        it('should still generate token for deactivated customer', async () => {
            const deactivated = await createTestUser({
                role: 'CUSTOMER',
                email: 'deactivated@test.com',
                phone: '8000000006',
                name: 'Deactivated User',
                isVerified: false
            });

            const res = await request(app)
                .post(`/api/v1/admin/users/${deactivated._id}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.token).toBeDefined();
        });

        it('deactivated customer token should still access profile', async () => {
            const deactivated = await createTestUser({
                role: 'CUSTOMER',
                email: 'deactivated2@test.com',
                phone: '8000000007',
                name: 'Deactivated User 2',
                isVerified: false
            });

            const tokenRes = await request(app)
                .post(`/api/v1/admin/users/${deactivated._id}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);

            const impToken = tokenRes.body.data.token;

            const profileRes = await request(app)
                .get('/api/v1/customers/me/profile')
                .set('Authorization', `Bearer ${impToken}`);

            expect(profileRes.status).toBe(200);
            expect(profileRes.body.data.name).toBe('Deactivated User 2');
        });
    });

    // ─── 13. Full Impersonation Lifecycle ─────────────────────────────────────
    describe('13. Full Impersonation Lifecycle', () => {
        it('should complete: create → impersonate → use token → verify activity log', async () => {
            // 1. Create customer
            const createRes = await request(app)
                .post('/api/v1/admin/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Lifecycle Imp Target',
                    phone: '8000000008',
                    role: 'CUSTOMER',
                    city: 'Delhi'
                });
            expect(createRes.status).toBe(201);
            const newCustomerId = createRes.body.data._id;

            // 2. Generate impersonation token
            const impRes = await request(app)
                .post(`/api/v1/admin/users/${newCustomerId}/impersonate`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(impRes.status).toBe(200);
            const impToken = impRes.body.data.token;

            // 3. Decode and verify token claims
            const decoded = jwt.verify(impToken, process.env.JWT_SECRET);
            expect(decoded.id).toBe(String(newCustomerId));
            expect(decoded.role).toBe('CUSTOMER');
            expect(decoded.isImpersonated).toBe(true);

            // 4. Access profile
            const profileRes = await request(app)
                .get('/api/v1/customers/me/profile')
                .set('Authorization', `Bearer ${impToken}`);
            expect(profileRes.status).toBe(200);
            expect(profileRes.body.data.name).toBe('Lifecycle Imp Target');
            expect(profileRes.body.data.city).toBe('Delhi');

            // 5. Access wallet
            const walletRes = await request(app)
                .get('/api/v1/wallet/balance')
                .set('Authorization', `Bearer ${impToken}`);
            expect(walletRes.status).toBe(200);

            // 6. Access top-pros
            const topProsRes = await request(app)
                .get('/api/v1/customers/top-pros')
                .set('Authorization', `Bearer ${impToken}`);
            expect(topProsRes.status).toBe(200);

            // 7. Verify activity log was created
            const logsRes = await request(app)
                .get('/api/v1/notifications/activity-logs')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(logsRes.status).toBe(200);
            const logs = logsRes.body.data?.logs || logsRes.body.data || [];
            const impLog = logs.find(l => l.action === 'IMPERSONATE' && String(l.entityId) === String(newCustomerId));
            expect(impLog).toBeDefined();
            expect(impLog.entityType).toBe('CUSTOMER');
            expect(impLog.title).toContain('Impersonation');
        });
    });
});
