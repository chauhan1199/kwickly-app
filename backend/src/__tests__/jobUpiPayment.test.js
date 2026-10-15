// Direct-UPI payment of a COMPLETED job: the customer pays the platform UPI ID and
// submits the UTR. The job is PAID only when a bank-credit SMS matches the UTR and
// amount, or an admin approves it.

// jest.mock calls are hoisted to the top by Babel — these MUST come before any require()
jest.mock('../helpers/redis.helper', () => ({
    initRedis: jest.fn(),
    getRedis: jest.fn(),
    setCache: jest.fn(),
    getCache: jest.fn(),
    delCache: jest.fn(),
    delCacheByPattern: jest.fn(),
    fetchWithCache: jest.fn(),
    acquireLock: jest.fn().mockResolvedValue('mock-holder-id'),
    releaseLock: jest.fn()
}));

jest.mock('../middleware/rateLimit.middleware', () => {
    const passThrough = (req, res, next) => next();
    return { globalLimiter: passThrough, authLimiter: passThrough, otpSendLimiter: passThrough };
});

jest.mock('../helpers/socket.helper', () => ({
    initSocket: jest.fn(),
    getIO: jest.fn(),
    emitToAll: jest.fn(),
    emitToRoom: jest.fn(),
    triggerDashboardUpdate: jest.fn(),
    emitToUser: jest.fn()
}));

jest.mock('../services/sms.service', () => ({
    sendOTP: jest.fn().mockResolvedValue('1234')
}));

const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Customer = require('../modules/customer/customer.model');
const Job = require('../modules/job/job.model');
const ShopOrder = require('../modules/shoporder/shoporder.model');
const BankCredit = require('../modules/payment/bankCredit.model');
const WalletTxn = require('../modules/wallet/wallet.model');
const PlatformLedger = require('../modules/ledger/platformLedger.model');
const { Promotion, UserPromoUsage } = require('../modules/promotion/promotion.model');
const { handleWalletTopupWebhook } = require('../helpers/webhookHandlers.helper');
const socket = require('../helpers/socket.helper');

beforeAll(async () => { await setup(); await Job.init(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); jest.clearAllMocks(); }, 10000);

const UTR = '412345678901';
const UTR2 = '598765432109';
const QUOTE = 400;
const FEE = 50;
const GST = 9;
const TOTAL = QUOTE + FEE + GST; // 459

describe('Job payment via direct UPI', () => {
    let customer, customerToken, worker, admin, adminToken, job;

    const balanceOf = async (id) => (await Customer.findById(id).lean()).wallet.balance;
    const credits = (jobId) => WalletTxn.countDocuments({ type: 'JOB_CREDIT', refId: String(jobId) });
    const ledgers = (jobId) => PlatformLedger.countDocuments({ idempotencyKey: `settle_job_${jobId}` });

    const payUpi = (body = {}, jobId = job._id) => request(app)
        .post(`/api/v1/jobs/${jobId}/pay`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ method: 'UPI', completionOtp: '2222', utrNumber: UTR, ...body });

    beforeEach(async () => {
        customer = await createTestUser({ role: 'CUSTOMER', email: 'c@t.com', phone: '9800000001', wallet: { balance: 50 } });
        customerToken = generateToken(customer);
        worker = await createTestUser({ role: 'WORKER', email: 'w@t.com', phone: '9800000002', wallet: { balance: 200 } });
        admin = await createTestUser({ role: 'ADMIN', email: 'a@t.com', phone: '9800000003' });
        adminToken = generateToken(admin);
        job = await Job.create({
            customerId: customer._id,
            workerId: worker._id,
            category: 'Plumbing',
            description: 'Fix leaking pipe',
            location: { type: 'Point', coordinates: [77.5946, 12.9716] },
            status: 'COMPLETED',
            payment: {
                amount: TOTAL, quotedAmount: QUOTE, workerPayout: QUOTE,
                platformFee: FEE, gst: GST, gstAmount: GST,
                status: 'PENDING', escrowStatus: 'LOCKED'
            },
            security: { arrivalOtp: '1111', completionOtp: '2222' }
        });
    });

    it('submitting a UTR puts the job in PENDING_VERIFICATION without paying anyone', async () => {
        const res = await payUpi();
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('COMPLETED');
        expect(res.body.data.payment.status).toBe('PENDING_VERIFICATION');

        const fresh = await Job.findById(job._id).lean();
        expect(fresh.payment).toMatchObject({ method: 'UPI', utrNumber: UTR, upiAmount: TOTAL, status: 'PENDING_VERIFICATION' });
        expect(await balanceOf(worker._id)).toBe(200);
        expect(await balanceOf(customer._id)).toBe(50); // the customer wallet is never touched
        expect(await credits(job._id)).toBe(0);
        expect(socket.emitToAll).toHaveBeenCalledWith('DASHBOARD_UPDATE', expect.objectContaining({ type: 'JOB_UPI_PENDING_VERIFICATION' }));

        // A second submission (or a cash/wallet payment) is refused while pending
        expect((await payUpi({ utrNumber: UTR2 })).status).toBe(409);
        const cash = await request(app).post(`/api/v1/jobs/${job._id}/pay`)
            .set('Authorization', `Bearer ${customerToken}`).send({ method: 'CASH', completionOtp: '2222' });
        expect(cash.status).toBe(409);
    });

    it('a matching bank SMS settles the job exactly once', async () => {
        await payUpi();
        await BankCredit.create({ utr: UTR, amount: TOTAL, isClaimed: false });
        await handleWalletTopupWebhook({ amount: TOTAL, utr: UTR }, UTR);
        await handleWalletTopupWebhook({ amount: TOTAL, utr: UTR }, UTR);

        const fresh = await Job.findById(job._id).lean();
        expect(fresh.status).toBe('PAID');
        expect(fresh.payment).toMatchObject({ status: 'PAID', method: 'UPI', escrowStatus: 'SETTLED' });
        expect(fresh.security?.completionOtp).toBeUndefined();
        expect(await balanceOf(worker._id)).toBe(200 + QUOTE);
        expect(await balanceOf(customer._id)).toBe(50);
        expect(await credits(job._id)).toBe(1);
        expect(await ledgers(job._id)).toBe(1);
        expect((await BankCredit.findOne({ utr: UTR }).lean()).isClaimed).toBe(true);
        expect(socket.emitToRoom).toHaveBeenCalledWith(`worker_${worker._id}`, 'JOB_PAID', expect.any(Object));
        expect(socket.emitToRoom).toHaveBeenCalledWith(`customer_${customer._id}`, 'JOB_PAID', expect.any(Object));
    });

    it('settles immediately when the bank credit is already recorded', async () => {
        await BankCredit.create({ utr: UTR, amount: TOTAL - 0.4, isClaimed: false });
        const res = await payUpi();
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('PAID');
        expect(res.body.data.payment.status).toBe('PAID');
        expect(await balanceOf(worker._id)).toBe(200 + QUOTE);
        expect(await credits(job._id)).toBe(1);
        expect(await ledgers(job._id)).toBe(1);
        expect((await BankCredit.findOne({ utr: UTR }).lean()).isClaimed).toBe(true);
    });

    it('an amount mismatch does not settle (SMS or at submission)', async () => {
        await BankCredit.create({ utr: UTR, amount: 100, isClaimed: false });
        const res = await payUpi();
        expect(res.body.data.payment.status).toBe('PENDING_VERIFICATION');
        await handleWalletTopupWebhook({ amount: 100, utr: UTR }, UTR);

        const fresh = await Job.findById(job._id).lean();
        expect(fresh.status).toBe('COMPLETED');
        expect(fresh.payment.status).toBe('PENDING_VERIFICATION');
        expect(await balanceOf(worker._id)).toBe(200);
        expect((await BankCredit.findOne({ utr: UTR }).lean()).isClaimed).toBe(false);
    });

    it('admin approval settles once; a repeat approval is refused', async () => {
        await payUpi();
        const approve = () => request(app).post(`/api/v1/jobs/${job._id}/verify-payment`).set('Authorization', `Bearer ${adminToken}`);
        const [a, b] = await Promise.all([approve(), approve()]);
        expect([a.status, b.status].sort()).toEqual([200, 409]);
        expect((await approve()).status).toBe(409);

        const fresh = await Job.findById(job._id).lean();
        expect(fresh.status).toBe('PAID');
        expect(fresh.payment.status).toBe('PAID');
        expect(await balanceOf(worker._id)).toBe(200 + QUOTE);
        expect(await credits(job._id)).toBe(1);
        expect(await ledgers(job._id)).toBe(1);
    });

    it('only an admin can approve or reject', async () => {
        await payUpi();
        const res = await request(app).post(`/api/v1/jobs/${job._id}/verify-payment`).set('Authorization', `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
    });

    it('admin rejection returns the job to payable and the customer can pay again', async () => {
        await Promotion.create({ code: 'SAVE20', title: 'Save 20', type: 'FLAT_DISCOUNT', value: 20, isActive: true });
        const first = await payUpi({ promoCode: 'save20' });
        expect(first.body.data.payment.upiAmount).toBe(TOTAL - 20);
        expect((await Promotion.findOne({ code: 'SAVE20' }).lean()).usesCount).toBe(1);

        const rej = await request(app).post(`/api/v1/jobs/${job._id}/reject-payment`)
            .set('Authorization', `Bearer ${adminToken}`).send({ reason: 'UTR not found in bank statement' });
        expect(rej.status).toBe(200);
        const fresh = await Job.findById(job._id).lean();
        expect(fresh.status).toBe('COMPLETED');
        expect(fresh.payment.status).toBe('PENDING');
        expect(fresh.payment.utrNumber).toBeUndefined();
        expect(fresh.promoCode).toBeUndefined();
        expect((await Promotion.findOne({ code: 'SAVE20' }).lean()).usesCount).toBe(0);
        expect(await UserPromoUsage.countDocuments({ userId: customer._id })).toBe(0);
        expect(await balanceOf(worker._id)).toBe(200);

        // Reject again → nothing to reject
        expect((await request(app).post(`/api/v1/jobs/${job._id}/reject-payment`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(409);

        const again = await payUpi({ utrNumber: UTR2 });
        expect(again.status).toBe(200);
        expect(again.body.data.payment.status).toBe('PENDING_VERIFICATION');
        expect(again.body.data.payment.utrNumber).toBe(UTR2);
    });

    it('a wrong completion OTP is rejected', async () => {
        const res = await payUpi({ completionOtp: '9999' });
        expect(res.status).toBe(400);
        expect((await Job.findById(job._id).lean()).payment.status).toBe('PENDING');
    });

    it('rejects an invalid UTR', async () => {
        expect((await payUpi({ utrNumber: '12345' })).status).toBe(400);
        expect((await payUpi({ utrNumber: undefined })).status).toBe(400);
    });

    it('rejects a UTR already used by a shop order, another job or a claimed bank credit, and releases the promo', async () => {
        await Promotion.create({ code: 'SAVE20', title: 'Save 20', type: 'FLAT_DISCOUNT', value: 20, isActive: true });
        await ShopOrder.collection.insertOne({ payment: { utrNumber: UTR, status: 'PAID', method: 'UPI' } });
        const res = await payUpi({ promoCode: 'SAVE20' });
        expect(res.status).toBe(409);
        expect((await Promotion.findOne({ code: 'SAVE20' }).lean()).usesCount).toBe(0);

        const otherJob = await Job.create({
            customerId: customer._id, workerId: worker._id, category: 'Plumbing',
            location: { type: 'Point', coordinates: [77.59, 12.97] }, status: 'COMPLETED',
            payment: { amount: TOTAL, workerPayout: QUOTE, platformFee: FEE, gst: GST, status: 'PENDING' },
            security: { completionOtp: '2222' }
        });
        expect((await payUpi({ utrNumber: UTR2 })).status).toBe(200);
        expect((await payUpi({ utrNumber: UTR2 }, otherJob._id)).status).toBe(409);

        await BankCredit.create({ utr: '512398764501', amount: TOTAL, isClaimed: true, claimedBy: worker._id });
        expect((await payUpi({ utrNumber: '512398764501' }, otherJob._id)).status).toBe(409);
        expect((await Job.findById(otherJob._id).lean()).payment.status).toBe('PENDING');
    });

    it('a wallet top-up cannot reuse a UTR held by a job payment', async () => {
        await payUpi();
        const { findUtrUsage } = require('../helpers/upi.helper');
        expect(await findUtrUsage(UTR)).toMatchObject({ flow: 'JOB_PAYMENT' });
    });
});
