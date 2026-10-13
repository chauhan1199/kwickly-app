const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Wallet Routes', () => {
    let customerToken, adminToken, customerId;

    beforeEach(async () => {
        const customer = await createTestUser({ role: 'CUSTOMER', email: 'walletcustomer@test.com', phone: '1234567890' });
        customerToken = generateToken(customer);
        customerId = customer._id;

        const admin = await createTestUser({ role: 'ADMIN', email: 'walletadmin@test.com', phone: '1234567891' });
        adminToken = generateToken(admin);
    });

    describe('GET /api/v1/wallet/balance', () => {
        it('should return wallet balance', async () => {
            const res = await request(app)
                .get('/api/v1/wallet/balance')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
        });

        it('should return all-time credit/debit totals beyond the first page', async () => {
            const WalletTxn = require('../modules/wallet/wallet.model');
            const txns = [];
            for (let i = 0; i < 25; i++) txns.push({ userId: customerId, type: 'TOPUP', amount: 10, balance: 0 });
            txns.push({ userId: customerId, type: 'ORDER_PAYMENT', amount: 40, balance: 0 });
            txns.push({ userId: customerId, type: 'ADJUSTMENT', amount: 5, balance: 0, description: 'Admin debit adjustment' });
            txns.push({ userId: customerId, type: 'ADJUSTMENT', amount: 7, balance: 0, description: 'Admin credit adjustment' });
            txns.push({ userId: customerId, type: 'TOPUP', amount: 999, balance: 0, status: 'PENDING' });
            await WalletTxn.insertMany(txns);
            const res = await request(app)
                .get('/api/v1/wallet/balance')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.transactions.length).toBe(20);
            expect(res.body.data.summary).toEqual({ totalCredits: 257, totalDebits: 45 });
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app).get('/api/v1/wallet/balance');
            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/v1/wallet/topup', () => {
        it('should reject top-up without verified Razorpay payment', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 500, paymentDetails: { method: 'UPI', txnId: 'test_txn_123' } });
            expect(res.status).toBe(400);
        });

        it('should reject with invalid amount', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: -100 });
            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/v1/wallet/withdraw', () => {
        it('should request withdrawal or fail with insufficient balance', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/withdraw')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 100, payoutMethod: 'UPI' });
            expect([200, 402]).toContain(res.status);
        });
    });

    describe('GET /api/v1/wallet/transactions (Admin)', () => {
        it('should return all transactions for admin', async () => {
            const res = await request(app)
                .get('/api/v1/wallet/transactions')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });

        it('should reject non-admin', async () => {
            const res = await request(app)
                .get('/api/v1/wallet/transactions')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('POST /api/v1/wallet/adjust (Admin)', () => {
        it('should adjust wallet for user (credit from admin wallet)', async () => {
            // Seed admin wallet with balance
            const { AdminWallet } = require('../modules/adminWallet/adminWallet.model');
            await AdminWallet.create({ balance: 10000 });

            const res = await request(app)
                .post('/api/v1/wallet/adjust')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ userId: customerId, amount: 200, type: 'ADJUSTMENT', description: 'Bonus' });
            expect(res.status).toBe(200);
            expect(res.body.data.adminBalance).toBeDefined();
            expect(res.body.data.adminBalance).toBe(9800);
        });

        it('should reject credit when admin wallet has insufficient balance', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/adjust')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ userId: customerId, amount: 999999, type: 'ADJUSTMENT', description: 'Huge credit' });
            expect(res.status).toBe(400);
        });

        it('should reject non-admin', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/adjust')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ userId: customerId, amount: 200, type: 'ADJUSTMENT' });
            expect(res.status).toBe(403);
        });
    });
});
