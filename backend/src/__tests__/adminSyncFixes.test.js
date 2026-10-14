const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Job = require('../modules/job/job.model');
const Shop = require('../modules/shop/shop.model');
const Product = require('../modules/product/product.model');
const ShopOrder = require('../modules/shoporder/shoporder.model');
const Payout = require('../modules/payout/payout.model');
const WalletTxn = require('../modules/wallet/wallet.model');
const Customer = require('../modules/customer/customer.model');

jest.mock('../services/cloudinary.service', () => ({
    uploadImage: jest.fn().mockResolvedValue({ url: 'https://res.cloudinary.com/test/x.jpg', public_id: 'x' }),
    cleanupImage: jest.fn(),
    uploadBase64: jest.fn().mockResolvedValue({ url: 'https://res.cloudinary.com/test/y.jpg', public_id: 'y' })
}));

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);

describe('Admin panel sync fixes', () => {
    let adminToken, customer, worker, seq = 0;
    const auth = () => ({ Authorization: `Bearer ${adminToken}` });

    beforeEach(async () => {
        await clearCollections();
        seq++;
        const p = String(seq).padStart(4, '0');
        const admin = await createTestUser({ role: 'ADMIN', email: `syncadm${seq}@t.com`, phone: `8110000${p}` });
        adminToken = generateToken(admin);
        customer = await createTestUser({ role: 'CUSTOMER', email: `synccust${seq}@t.com`, phone: `8220000${p}`, name: 'Sync Customer' });
        worker = await createTestUser({
            role: 'WORKER', email: `syncwrk${seq}@t.com`, phone: `8330000${p}`, name: 'Sync Worker',
            services: [{ categoryName: 'Plumbing' }],
            wallet: { balance: 0 }
        });
    });

    const makeJob = (o = {}) => Job.create({
        customerId: customer._id, category: 'Plumbing', description: 'x',
        location: { type: 'Point', coordinates: [77.59, 12.97] },
        addressDetails: { city: 'Bangalore', fullAddress: '1 Main St' },
        status: 'BROADCASTING', payment: { amount: 500, status: 'PENDING' }, ...o
    });
    const makeShop = async () => {
        const owner = await createTestUser({ role: 'SHOP', email: `syncshop${seq}@t.com`, phone: `8440000${String(seq).padStart(4, '0')}` });
        return Shop.create({ ownerId: owner._id, name: 'Sync Shop', category: 'Groceries', address: 'addr', kyc: { status: 'PENDING' } });
    };
    let orderSeq = 0;
    const makeOrder = (shopId, o = {}) => ShopOrder.create({
        orderNumber: `SYNC-${seq}-${++orderSeq}`, shopId, customerId: customer._id, items: [{ name: 'Milk', price: 100, qty: 1 }],
        subtotal: 100, total: 112, platformFee: 10, gstAmount: 2, status: 'NEW',
        payment: { amount: 112, status: 'PENDING' }, ...o
    });

    describe('#1/#7 dashboard stats', () => {
        it('platformRevenue counts only PAID jobs (fee + GST) plus delivered/paid shop orders', async () => {
            await makeJob({ status: 'CLOSED', workerId: worker._id, payment: { amount: 1180, platformFee: 100, gst: 18, workerPayout: 1062, status: 'PAID' } });
            await makeJob({ status: 'ALLOCATED', workerId: worker._id, payment: { amount: 590, platformFee: 50, gst: 9, status: 'PENDING' } });
            const shop = await makeShop();
            await makeOrder(shop._id, { status: 'DELIVERED' });
            await makeOrder(shop._id, { status: 'CONFIRMED', payment: { amount: 112, status: 'PAID' } });
            await makeOrder(shop._id, { status: 'NEW' });                         // unpaid → excluded
            await makeOrder(shop._id, { status: 'CANCELLED', payment: { amount: 112, status: 'PAID' } }); // cancelled → excluded

            const res = await request(app).get('/api/v1/admin/stats?range=week').set(auth());
            expect(res.status).toBe(200);
            expect(res.body.data.jobPlatformRevenue).toBe(118);
            expect(res.body.data.shopPlatformRevenue).toBe(24);
            expect(res.body.data.platformRevenue).toBe(142);
            // Gross value (legacy totalRevenue) is unchanged
            expect(res.body.data.totalRevenue).toBe(1770);
            expect(res.body.data.grossValue).toBe(1770);
            const today = res.body.data.chartData[res.body.data.chartData.length - 1];
            expect(today.revenue).toBe(142);
            expect(res.body.data.chartData).toHaveLength(7);
        });

        it('activeJobs includes DISPUTED; top workers include CLOSED with category name', async () => {
            await makeJob({ status: 'DISPUTED', workerId: worker._id });
            await makeJob({ status: 'CLOSED', workerId: worker._id, payment: { amount: 500, workerPayout: 450, status: 'PAID' } });
            const res = await request(app).get('/api/v1/admin/stats?range=all').set(auth());
            expect(res.body.data.activeJobs).toBe(1);
            const top = res.body.data.topWorkers.find(w => w.name === 'Sync Worker');
            expect(top).toBeDefined();
            expect(top.category).toBe('Plumbing');
            expect(res.body.data.chartData).toHaveLength(12);
        });

        it('chart buckets follow the selected range', async () => {
            const res = await request(app).get('/api/v1/admin/stats?range=month').set(auth());
            expect(res.body.data.chartData.length).toBeGreaterThan(27);
        });

        it('badge disputes count includes worker-reported DISPUTED jobs', async () => {
            await makeJob({ status: 'DISPUTED', workerId: worker._id });
            const res = await request(app).get('/api/v1/admin/badges').set(auth());
            expect(res.body.data.disputes).toBe(1);
            expect(res.body.data.jobDisputes).toBe(1);
        });
    });

    describe('#3 job disputes listing', () => {
        it('GET /admin/jobs/disputes lists DISPUTED jobs (not swallowed by /jobs/:id)', async () => {
            await makeJob({ status: 'DISPUTED', workerId: worker._id, dispute: { reportedBy: 'WORKER', amountReceived: 300, shortAmount: 200, status: 'OPEN', reportedAt: new Date() } });
            await makeJob();
            const res = await request(app).get('/api/v1/admin/jobs/disputes').set(auth());
            expect(res.status).toBe(200);
            expect(res.body.data.disputes).toHaveLength(1);
            expect(res.body.data.disputes[0].dispute.shortAmount).toBe(200);
        });
    });

    describe('#7 job search', () => {
        it('matches addressDetails.city', async () => {
            await makeJob({ addressDetails: { city: 'Mysuru', fullAddress: 'x' } });
            await makeJob();
            const res = await request(app).get('/api/v1/admin/jobs/all?search=mysuru').set(auth());
            expect(res.status).toBe(200);
            expect(res.body.data.totalJobs).toBe(1);
            expect(res.body.data.jobs[0].addressDetails.city).toBe('Mysuru');
        });
    });

    describe('#8 customer orders populate', () => {
        it('populates items.productId without throwing', async () => {
            const shop = await makeShop();
            const product = await Product.create({ shopId: shop._id, name: 'Bread', price: 40 });
            await makeOrder(shop._id, { items: [{ productId: product._id, name: 'Bread', price: 40, qty: 1 }] });
            const res = await request(app).get(`/api/v1/admin/customers/${customer._id}/orders`).set(auth());
            expect(res.status).toBe(200);
            expect(res.body.data.orders).toHaveLength(1);
            expect(res.body.data.orders[0].items[0].productId.name).toBe('Bread');
        });
    });

    describe('#12 KYC total honours type filter', () => {
        it('kycType=WORKER total excludes shops', async () => {
            await Customer.updateOne({ _id: worker._id }, { 'kyc.status': 'PENDING' });
            await makeShop();
            const all = await request(app).get('/api/v1/admin/pending-kyc').set(auth());
            expect(all.body.data.total).toBe(2);
            const w = await request(app).get('/api/v1/admin/pending-kyc?kycType=WORKER').set(auth());
            expect(w.body.data.total).toBe(1);
            expect(w.body.data.items).toHaveLength(1);
            const s = await request(app).get('/api/v1/admin/pending-kyc?kycType=SHOP').set(auth());
            expect(s.body.data.total).toBe(1);
        });
    });

    describe('payout status guard', () => {
        const makePayout = async () => {
            const wTxn = await WalletTxn.create({ userId: worker._id, type: 'WITHDRAWAL', amount: 300, balance: 0, status: 'PENDING' });
            return Payout.create({ workerId: worker._id, amount: 300, status: 'PENDING', paymentMethod: 'UPI', paymentDetails: 'w@upi', walletTxnId: wTxn._id });
        };

        it('reject refunds once, writes a REFUND txn and marks the withdrawal FAILED', async () => {
            const payout = await makePayout();
            const res = await request(app).patch(`/api/v1/admin/payouts/${payout._id}/status`).set(auth()).send({ status: 'REJECTED', rejectReason: 'bad details' });
            expect(res.status).toBe(200);
            expect((await Customer.findById(worker._id)).wallet.balance).toBe(300);
            expect((await WalletTxn.findById(payout.walletTxnId)).status).toBe('FAILED');
            const refunds = await WalletTxn.find({ userId: worker._id, type: 'REFUND' });
            expect(refunds).toHaveLength(1);
            expect(refunds[0].amount).toBe(300);

            const again = await request(app).patch(`/api/v1/admin/payouts/${payout._id}/status`).set(auth()).send({ status: 'REJECTED' });
            expect(again.status).toBe(409);
            const flip = await request(app).patch(`/api/v1/admin/payouts/${payout._id}/status`).set(auth()).send({ status: 'TRANSFERRED', txnId: 'X' });
            expect(flip.status).toBe(409);
            expect((await Customer.findById(worker._id)).wallet.balance).toBe(300);
            expect(await WalletTxn.countDocuments({ userId: worker._id, type: 'REFUND' })).toBe(1);
        });

        it('concurrent rejects refund only once', async () => {
            const payout = await makePayout();
            const send = () => request(app).patch(`/api/v1/admin/payouts/${payout._id}/status`).set(auth()).send({ status: 'REJECTED' });
            const results = await Promise.all([send(), send()]);
            expect(results.map(r => r.status).sort()).toEqual([200, 409]);
            expect((await Customer.findById(worker._id)).wallet.balance).toBe(300);
        });

        it('transferred payout cannot be rejected or transferred again', async () => {
            const payout = await makePayout();
            const t = await request(app).patch(`/api/v1/admin/payouts/${payout._id}/status`).set(auth()).send({ status: 'TRANSFERRED', txnId: '123456789999' });
            expect(t.status).toBe(200);
            expect((await WalletTxn.findById(payout.walletTxnId)).status).toBe('COMPLETED');
            const r = await request(app).patch(`/api/v1/admin/payouts/${payout._id}/status`).set(auth()).send({ status: 'REJECTED' });
            expect(r.status).toBe(409);
            const t2 = await request(app).patch(`/api/v1/admin/payouts/${payout._id}/status`).set(auth()).send({ status: 'TRANSFERRED' });
            expect(t2.status).toBe(409);
            expect((await Customer.findById(worker._id)).wallet.balance).toBe(0);
        });
    });
});
