const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const { AdminWallet, AdminWalletTxn } = require('../modules/adminWallet/adminWallet.model');

// Mock razorpay helper
jest.mock('../helpers/razorpay.helper', () => ({
    createRazorpayOrder: jest.fn().mockResolvedValue({
        id: 'order_test123',
        amount: 50000,
        currency: 'INR'
    }),
    verifyPaymentSignature: jest.fn().mockReturnValue(true),
    fetchPayment: jest.fn().mockResolvedValue({
        status: 'captured',
        method: 'upi',
        amount: 50000
        })
    }));

const { createRazorpayOrder, verifyPaymentSignature, fetchPayment } = require('../helpers/razorpay.helper');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Admin Wallet Routes', () => {
    let adminToken, customerToken, adminId;

    beforeEach(async () => {
        const admin = await createTestUser({ role: 'ADMIN', email: 'adminwallet@test.com', phone: '1111111111' });
        adminToken = generateToken(admin);
        adminId = admin._id;

        const customer = await createTestUser({ role: 'CUSTOMER', email: 'custwallet@test.com', phone: '2222222222' });
        customerToken = generateToken(customer);

        jest.clearAllMocks();
    });

    // ─── GET /balance ────────────────────────────────────────────────────
    describe('GET /api/v1/admin/admin-wallet/balance', () => {
        it('should return wallet balance with default zero', async () => {
            const res = await request(app)
                .get('/api/v1/admin/admin-wallet/balance')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.balance).toBe(0);
            expect(res.body.data).toHaveProperty('bankDetails');
        });

        it('should return existing wallet balance after credit', async () => {
            await AdminWallet.create({ balance: 5000 });

            const res = await request(app)
                .get('/api/v1/admin/admin-wallet/balance')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.balance).toBe(5000);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app).get('/api/v1/admin/admin-wallet/balance');
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .get('/api/v1/admin/admin-wallet/balance')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    // ─── GET /transactions ───────────────────────────────────────────────
    describe('GET /api/v1/admin/admin-wallet/transactions', () => {
        it('should return empty transactions initially', async () => {
            const res = await request(app)
                .get('/api/v1/admin/admin-wallet/transactions')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.txns).toEqual([]);
            expect(res.body.data.total).toBe(0);
            expect(res.body.data.totalPages).toBe(0);
        });

        it('should return seeded transactions', async () => {
            const wallet = await AdminWallet.create({ balance: 5000 });
            await AdminWalletTxn.create([
                { type: 'MANUAL_CREDIT', amount: 3000, balanceAfter: 3000, description: 'Seed 1' },
                { type: 'MANUAL_DEBIT', amount: 500, balanceAfter: 2500, description: 'Seed 2' },
                { type: 'TOPUP', amount: 2500, balanceAfter: 5000, description: 'Seed 3' }
            ]);

            const res = await request(app)
                .get('/api/v1/admin/admin-wallet/transactions')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.txns.length).toBe(3);
            expect(res.body.data.total).toBe(3);
        });

        it('should filter transactions by type', async () => {
            await AdminWalletTxn.create([
                { type: 'MANUAL_CREDIT', amount: 1000, balanceAfter: 1000, description: 'Credit 1' },
                { type: 'MANUAL_DEBIT', amount: 200, balanceAfter: 800, description: 'Debit 1' },
                { type: 'MANUAL_CREDIT', amount: 500, balanceAfter: 1300, description: 'Credit 2' }
            ]);

            const res = await request(app)
                .get('/api/v1/admin/admin-wallet/transactions?type=MANUAL_CREDIT')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.txns.length).toBe(2);
            expect(res.body.data.txns.every(t => t.type === 'MANUAL_CREDIT')).toBe(true);
        });

        it('should paginate transactions', async () => {
            const txns = Array.from({ length: 12 }, (_, i) => ({
                type: 'MANUAL_CREDIT',
                amount: i + 1,
                balanceAfter: (i + 1) * 100,
                description: `Txn ${i + 1}`
            }));
            await AdminWalletTxn.create(txns);

            const res = await request(app)
                .get('/api/v1/admin/admin-wallet/transactions?page=2&limit=5')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.txns.length).toBe(5);
            expect(res.body.data.page).toBe(2);
            expect(res.body.data.total).toBe(12);
            expect(res.body.data.totalPages).toBe(3);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app).get('/api/v1/admin/admin-wallet/transactions');
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .get('/api/v1/admin/admin-wallet/transactions')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });

        it('should treat type=all as no filter', async () => {
            await AdminWalletTxn.create([
                { type: 'MANUAL_CREDIT', amount: 1000, balanceAfter: 1000, description: 'Credit' },
                { type: 'MANUAL_DEBIT', amount: 200, balanceAfter: 800, description: 'Debit' }
            ]);

            const res = await request(app)
                .get('/api/v1/admin/admin-wallet/transactions?type=all')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.txns.length).toBe(2);
        });
    });

    // ─── POST /credit ────────────────────────────────────────────────────
    describe('POST /api/v1/admin/admin-wallet/credit', () => {
        it('should credit wallet with valid amount', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/credit')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 1000, description: 'Test credit', paymentMethod: 'CASH' });

            expect(res.status).toBe(200);
            expect(res.body.data.balance).toBe(1000);
            expect(res.body.data.txn.type).toBe('MANUAL_CREDIT');
            expect(res.body.data.txn.amount).toBe(1000);
        });

        it('should accumulate balance on multiple credits', async () => {
            await request(app)
                .post('/api/v1/admin/admin-wallet/credit')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 500 });

            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/credit')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 300 });

            expect(res.status).toBe(200);
            expect(res.body.data.balance).toBe(800);
        });

        it('should reject with zero amount', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/credit')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 0 });

            expect(res.status).toBe(400);
        });

        it('should reject with negative amount', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/credit')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: -500 });

            expect(res.status).toBe(400);
        });

        it('should reject with missing amount', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/credit')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ description: 'No amount' });

            expect(res.status).toBe(400);
        });

        it('should reject with non-numeric amount', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/credit')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 'abc' });

            expect(res.status).toBe(400);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/credit')
                .send({ amount: 500 });
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/credit')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 500 });
            expect(res.status).toBe(403);
        });
    });

    // ─── POST /debit ─────────────────────────────────────────────────────
    describe('POST /api/v1/admin/admin-wallet/debit', () => {
        beforeEach(async () => {
            await request(app)
                .post('/api/v1/admin/admin-wallet/credit')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 5000 });
        });

        it('should debit wallet with sufficient balance', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/debit')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 2000, description: 'Test debit' });

            expect(res.status).toBe(200);
            expect(res.body.data.balance).toBe(3000);
            expect(res.body.data.txn.type).toBe('MANUAL_DEBIT');
            expect(res.body.data.txn.amount).toBe(2000);
        });

        it('should debit exact balance leaving zero', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/debit')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 5000 });

            expect(res.status).toBe(200);
            expect(res.body.data.balance).toBe(0);
        });

        it('should reject with insufficient balance (402)', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/debit')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 99999 });

            expect(res.status).toBe(402);
        });

        it('should reject with zero amount', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/debit')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 0 });

            expect(res.status).toBe(400);
        });

        it('should reject with negative amount', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/debit')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: -100 });

            expect(res.status).toBe(400);
        });

        it('should reject with missing amount', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/debit')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(res.status).toBe(400);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/debit')
                .send({ amount: 100 });
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/debit')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 100 });
            expect(res.status).toBe(403);
        });
    });

    // ─── PATCH /bank-details ─────────────────────────────────────────────
    describe('PATCH /api/v1/admin/admin-wallet/bank-details', () => {
        const validDetails = {
            accountHolder: 'John Doe',
            accountNumber: '123456789012',
            ifscCode: 'SBIN0001234',
            bankName: 'State Bank of India',
            upiId: 'john@upi'
        };

        it('should update bank details with valid data', async () => {
            const res = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(validDetails);

            expect(res.status).toBe(200);
            expect(res.body.data.bankDetails.accountHolder).toBe('John Doe');
            expect(res.body.data.bankDetails.accountNumber).toBe('123456789012');
            expect(res.body.data.bankDetails.ifscCode).toBe('SBIN0001234');
            expect(res.body.data.bankDetails.bankName).toBe('State Bank of India');
            expect(res.body.data.upiId).toBe('john@upi');
        });

        it('should update without optional upiId', async () => {
            const { upiId, ...noUpi } = validDetails;
            const res = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(noUpi);

            expect(res.status).toBe(200);
            expect(res.body.data.bankDetails.accountHolder).toBe('John Doe');
        });

        it('should reject when accountHolder is missing', async () => {
            const res = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...validDetails, accountHolder: '' });

            expect(res.status).toBe(400);
        });

        it('should reject when accountHolder is whitespace only', async () => {
            const res = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...validDetails, accountHolder: '   ' });

            expect(res.status).toBe(400);
        });

        it('should reject account number shorter than 9 digits', async () => {
            const res = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...validDetails, accountNumber: '12345678' });

            expect(res.status).toBe(400);
        });

        it('should reject account number longer than 18 digits', async () => {
            const res = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...validDetails, accountNumber: '1234567890123456789' });

            expect(res.status).toBe(400);
        });

        it('should reject account number with letters', async () => {
            const res = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...validDetails, accountNumber: '12345abcde' });

            expect(res.status).toBe(400);
        });

        it('should accept account numbers at boundary lengths (9 and 18)', async () => {
            const nineDigit = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...validDetails, accountNumber: '123456789' });
            expect(nineDigit.status).toBe(200);

            const eighteenDigit = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...validDetails, accountNumber: '123456789012345678' });
            expect(eighteenDigit.status).toBe(200);
        });

        it('should reject invalid IFSC code format', async () => {
            const res = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...validDetails, ifscCode: 'INVALID' });

            expect(res.status).toBe(400);
        });

        it('should reject IFSC code without leading zero', async () => {
            const res = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...validDetails, ifscCode: 'SBIN1001234' });

            expect(res.status).toBe(400);
        });

        it('should reject IFSC code that is too short', async () => {
            const res = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...validDetails, ifscCode: 'SBIN0' });

            expect(res.status).toBe(400);
        });

        it('should accept valid IFSC codes with mixed case', async () => {
            const upper = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...validDetails, ifscCode: 'SBIN0001234' });
            expect(upper.status).toBe(200);

            const lower = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...validDetails, ifscCode: 'sbin0001234' });
            expect(lower.status).toBe(200);
        });

        it('should reject when bankName is missing', async () => {
            const res = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...validDetails, bankName: '' });

            expect(res.status).toBe(400);
        });

        it('should reject invalid UPI ID format', async () => {
            const res = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...validDetails, upiId: 'invalid-upi' });

            expect(res.status).toBe(400);
        });

        it('should accept various valid UPI ID formats', async () => {
            const res = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...validDetails, upiId: 'user.name-123@bank' });
            expect(res.status).toBe(200);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .send(validDetails);
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .patch('/api/v1/admin/admin-wallet/bank-details')
                .set('Authorization', `Bearer ${customerToken}`)
                .send(validDetails);
            expect(res.status).toBe(403);
        });
    });

    // ─── POST /razorpay-order ────────────────────────────────────────────
    describe('POST /api/v1/admin/admin-wallet/razorpay-order', () => {
        it('should create Razorpay order', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/razorpay-order')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 500 });

            expect(res.status).toBe(201);
            expect(res.body.data.razorpayOrderId).toBe('order_test123');
            expect(res.body.data.amount).toBe(50000);
            expect(res.body.data.currency).toBe('INR');
            expect(createRazorpayOrder).toHaveBeenCalled();
        });

        it('should reject with zero amount', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/razorpay-order')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 0 });

            expect(res.status).toBe(400);
        });

        it('should reject with negative amount', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/razorpay-order')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: -100 });

            expect(res.status).toBe(400);
        });

        it('should reject with missing amount', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/razorpay-order')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(res.status).toBe(400);
        });

        it('should handle razorpay order creation failure', async () => {
            createRazorpayOrder.mockRejectedValueOnce(new Error('Gateway timeout'));

            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/razorpay-order')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 500 });

            expect(res.status).toBe(500);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/razorpay-order')
                .send({ amount: 500 });
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/razorpay-order')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ amount: 500 });
            expect(res.status).toBe(403);
        });
    });

    // ─── POST /razorpay-verify ───────────────────────────────────────────
    describe('POST /api/v1/admin/admin-wallet/razorpay-verify', () => {
        it('should verify payment and credit wallet', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/razorpay-verify')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    razorpayOrderId: 'order_test123',
                    razorpayPaymentId: 'pay_test456',
                    razorpaySignature: 'sig_test789'
                });

            expect(res.status).toBe(200);
            expect(res.body.data.balance).toBe(500); // 50000 paise / 100
            expect(res.body.data.txn.type).toBe('TOPUP');
            expect(verifyPaymentSignature).toHaveBeenCalledWith('order_test123', 'pay_test456', 'sig_test789');
        });

        it('should reject when razorpayOrderId is missing', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/razorpay-verify')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    razorpayPaymentId: 'pay_test456',
                    razorpaySignature: 'sig_test789'
                });

            expect(res.status).toBe(400);
        });

        it('should reject when razorpayPaymentId is missing', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/razorpay-verify')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    razorpayOrderId: 'order_test123',
                    razorpaySignature: 'sig_test789'
                });

            expect(res.status).toBe(400);
        });

        it('should reject when razorpaySignature is missing', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/razorpay-verify')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    razorpayOrderId: 'order_test123',
                    razorpayPaymentId: 'pay_test456'
                });

            expect(res.status).toBe(400);
        });

        it('should reject when signature verification fails', async () => {
            verifyPaymentSignature.mockReturnValueOnce(false);

            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/razorpay-verify')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    razorpayOrderId: 'order_test123',
                    razorpayPaymentId: 'pay_test456',
                    razorpaySignature: 'bad_sig'
                });

            expect(res.status).toBe(400);
        });

        it('should reject when payment not captured', async () => {
            fetchPayment.mockResolvedValueOnce({ status: 'created', method: 'upi', amount: 50000 });

            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/razorpay-verify')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    razorpayOrderId: 'order_test123',
                    razorpayPaymentId: 'pay_test456',
                    razorpaySignature: 'sig_test789'
                });

            expect(res.status).toBe(400);
        });

        it('should reject when fetchPayment throws (no fallback)', async () => {
            fetchPayment.mockRejectedValueOnce(new Error('Network error'));

            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/razorpay-verify')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    razorpayOrderId: 'order_test123',
                    razorpayPaymentId: 'pay_test456',
                    razorpaySignature: 'sig_test789'
                });

            // Now returns error instead of fallback with fake data
            expect(res.status).toBe(400);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/razorpay-verify')
                .send({
                    razorpayOrderId: 'order_test123',
                    razorpayPaymentId: 'pay_test456',
                    razorpaySignature: 'sig_test789'
                });
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .post('/api/v1/admin/admin-wallet/razorpay-verify')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    razorpayOrderId: 'order_test123',
                    razorpayPaymentId: 'pay_test456',
                    razorpaySignature: 'sig_test789'
                });
            expect(res.status).toBe(403);
        });
    });
});
