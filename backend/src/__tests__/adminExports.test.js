const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Job = require('../modules/job/job.model');
const WalletTxn = require('../modules/wallet/wallet.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);

describe('Admin Export Endpoints', () => {
    let adminToken, customerToken;
    let seq = 0;

    beforeEach(async () => {
        await clearCollections();
        jest.clearAllMocks();
        seq++;
        const admin = await createTestUser({ role: 'ADMIN', email: `exportadmin${seq}@test.com`, phone: `810000${String(seq).padStart(4, '0')}` });
        adminToken = generateToken(admin);

        const customer = await createTestUser({ role: 'CUSTOMER', email: `exportcust${seq}@test.com`, phone: `820000${String(seq).padStart(4, '0')}` });
        customerToken = generateToken(customer);
    });

    describe('GET /api/v1/admin/jobs/export', () => {
        it('should return CSV data for jobs', async () => {
            await Job.create({
                customerId: (await createTestUser({ role: 'CUSTOMER', email: `jobexport${seq}@test.com`, phone: `830000${String(seq).padStart(4, '0')}` }))._id,
                category: 'Plumbing',
                description: 'Fix leaky faucet',
                status: 'COMPLETED',
                payment: { amount: 500, status: 'PAID' },
                location: { type: 'Point', coordinates: [77.5946, 12.9716] }
            });

            const res = await request(app)
                .get('/api/v1/admin/jobs/export')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\/csv/);
            expect(res.text).toContain('ID,Customer,Worker,Category,Status,Amount,CreatedAt');
        });

        it('should return CSV with just headers when no jobs exist', async () => {
            const res = await request(app)
                .get('/api/v1/admin/jobs/export')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\/csv/);
            expect(res.text).toContain('ID,Customer,Worker,Category,Status,Amount,CreatedAt');
        });

        it('should require admin authentication', async () => {
            const res = await request(app)
                .get('/api/v1/admin/jobs/export');

            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .get('/api/v1/admin/jobs/export')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/v1/admin/payments/export', () => {
        it('should return CSV data for payments', async () => {
            const user = await createTestUser({ role: 'CUSTOMER', email: `payexport${seq}@test.com`, phone: `840000${String(seq).padStart(4, '0')}` });
            await WalletTxn.create({
                userId: user._id,
                type: 'ORDER_PAYMENT',
                amount: 1000,
                balance: 5000,
                status: 'COMPLETED',
                description: 'Test payment'
            });

            const res = await request(app)
                .get('/api/v1/admin/payments/export')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\/csv/);
            expect(res.text).toContain('ID,User,Type,Amount,Status,RefId,CreatedAt');
        });

        it('should return CSV with just headers when no payments exist', async () => {
            const res = await request(app)
                .get('/api/v1/admin/payments/export')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.text).toContain('ID,User,Type,Amount,Status,RefId,CreatedAt');
        });

        it('should require admin authentication', async () => {
            const res = await request(app)
                .get('/api/v1/admin/payments/export');

            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .get('/api/v1/admin/payments/export')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/v1/admin/customers/export', () => {
        it('should return CSV data for customers', async () => {
            await createTestUser({ role: 'CUSTOMER', email: `custexport1${seq}@test.com`, phone: `850000${String(seq).padStart(4, '0')}` });
            await createTestUser({ role: 'CUSTOMER', email: `custexport2${seq}@test.com`, phone: `850001${String(seq).padStart(4, '0')}` });

            const res = await request(app)
                .get('/api/v1/admin/customers/export')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\/csv/);
            expect(res.text).toContain('ID,Name,Phone,Email,Verified,CreatedAt');
        });

        it('should require admin authentication', async () => {
            const res = await request(app)
                .get('/api/v1/admin/customers/export');

            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .get('/api/v1/admin/customers/export')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/v1/admin/workers/export', () => {
        it('should return CSV data for workers', async () => {
            await createTestUser({ role: 'WORKER', email: `wkexport${seq}@test.com`, phone: `860000${String(seq).padStart(4, '0')}` });

            const res = await request(app)
                .get('/api/v1/admin/workers/export')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\/csv/);
            expect(res.text).toContain('ID,Name,Phone,KYC Status,Verified,CreatedAt');
        });

        it('should require admin authentication', async () => {
            const res = await request(app)
                .get('/api/v1/admin/workers/export');

            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .get('/api/v1/admin/workers/export')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(403);
        });
    });
});
