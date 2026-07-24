const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const WalletTxn = require('../modules/wallet/wallet.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Admin Ledger Routes', () => {
    let adminToken, customerToken, testUser;

    beforeEach(async () => {
        const admin = await createTestUser({ role: 'ADMIN', email: 'adminledger@test.com', phone: '7001000001' });
        adminToken = generateToken(admin);

        const customer = await createTestUser({ role: 'CUSTOMER', email: 'custledger@test.com', phone: '7001000002' });
        customerToken = generateToken(customer);
        testUser = customer;
    });

    describe('GET /api/v1/admin/ledger (paginated entries)', () => {
        it('should return paginated ledger entries', async () => {
            const res = await request(app)
                .get('/api/v1/admin/ledger')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('transactions');
            expect(res.body.data).toHaveProperty('total');
            expect(res.body.data).toHaveProperty('page');
            expect(res.body.data).toHaveProperty('totalPages');
            expect(Array.isArray(res.body.data.transactions)).toBe(true);
        });
    });

    describe('GET /api/v1/admin/ledger (empty)', () => {
        it('should return empty transactions when no data exists', async () => {
            const res = await request(app)
                .get('/api/v1/admin/ledger')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.transactions).toEqual([]);
            expect(res.body.data.total).toBe(0);
            expect(res.body.data.totalPages).toBe(0);
        });
    });

    describe('GET /api/v1/admin/ledger (seeded data)', () => {
        it('should return seeded transactions', async () => {
            await WalletTxn.create([
                { userId: testUser._id, type: 'TOPUP', amount: 1000, balance: 1000, description: 'Topup 1' },
                { userId: testUser._id, type: 'JOB_CREDIT', amount: 500, balance: 1500, description: 'Job credit' },
                { userId: testUser._id, type: 'ADJUSTMENT', amount: 200, balance: 1700, description: 'Admin adjustment' }
            ]);
            const res = await request(app)
                .get('/api/v1/admin/ledger')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.transactions.length).toBe(3);
            expect(res.body.data.total).toBe(3);
        });
    });

    describe('GET /api/v1/admin/ledger (filter by type)', () => {
        it('should filter by type', async () => {
            await WalletTxn.create([
                { userId: testUser._id, type: 'TOPUP', amount: 1000, balance: 1000, description: 'Topup' },
                { userId: testUser._id, type: 'JOB_CREDIT', amount: 500, balance: 1500, description: 'Credit' },
                { userId: testUser._id, type: 'TOPUP', amount: 300, balance: 1800, description: 'Topup 2' }
            ]);
            const res = await request(app)
                .get('/api/v1/admin/ledger?type=TOPUP')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.transactions.length).toBe(2);
            expect(res.body.data.transactions.every(t => t.type === 'TOPUP')).toBe(true);
        });
    });

    describe('GET /api/v1/admin/ledger (type=all)', () => {
        it('should treat type=all as no filter', async () => {
            await WalletTxn.create([
                { userId: testUser._id, type: 'TOPUP', amount: 1000, balance: 1000, description: 'Topup' },
                { userId: testUser._id, type: 'JOB_CREDIT', amount: 500, balance: 1500, description: 'Credit' }
            ]);
            const res = await request(app)
                .get('/api/v1/admin/ledger?type=all')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.transactions.length).toBe(2);
        });
    });

    describe('GET /api/v1/admin/ledger (pagination)', () => {
        it('should paginate results', async () => {
            const txns = Array.from({ length: 12 }, (_, i) => ({
                userId: testUser._id,
                type: 'TOPUP',
                amount: (i + 1) * 100,
                balance: (i + 1) * 100,
                description: `Txn ${i + 1}`
            }));
            await WalletTxn.create(txns);
            const res = await request(app)
                .get('/api/v1/admin/ledger?page=2&limit=5')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.transactions.length).toBe(5);
            expect(res.body.data.page).toBe(2);
            expect(res.body.data.total).toBe(12);
            expect(res.body.data.totalPages).toBe(3);
        });
    });

    describe('GET /api/v1/admin/ledger (defaults)', () => {
        it('should use default page=1 and limit=50', async () => {
            const txns = Array.from({ length: 5 }, (_, i) => ({
                userId: testUser._id,
                type: 'TOPUP',
                amount: (i + 1) * 100,
                balance: (i + 1) * 100,
                description: `Txn ${i + 1}`
            }));
            await WalletTxn.create(txns);
            const res = await request(app)
                .get('/api/v1/admin/ledger')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.page).toBe(1);
            expect(res.body.data.transactions.length).toBe(5);
        });
    });

    describe('GET /api/v1/admin/ledger (non-admin)', () => {
        it('should reject non-admin', async () => {
            const res = await request(app)
                .get('/api/v1/admin/ledger')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/v1/admin/ledger (unauthenticated)', () => {
        it('should reject unauthenticated', async () => {
            const res = await request(app)
                .get('/api/v1/admin/ledger');
            expect(res.status).toBe(401);
        });
    });
});
