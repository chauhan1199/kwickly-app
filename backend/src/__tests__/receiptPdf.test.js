const request = require('supertest');
const zlib = require('zlib');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Job = require('../modules/job/job.model');
const WalletTxn = require('../modules/wallet/wallet.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

// Decode the page's text so assertions can look for the printed values
const pageText = (pdf) => {
    const s = pdf.toString('latin1');
    const start = s.indexOf('4 0 obj');
    const streamAt = s.indexOf('stream\n', start) + 7;
    const len = Number(/\/Length (\d+)/.exec(s.slice(start))[1]);
    const ops = zlib.inflateSync(pdf.subarray(streamAt, streamAt + len)).toString('latin1');
    return [...ops.matchAll(/\((.*?)\) Tj/g)].map(m => m[1]).join('\n');
};

const expectValidPdf = (pdf) => {
    expect(pdf.subarray(0, 8).toString()).toBe('%PDF-1.4');
    expect(pdf.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);
    // every xref offset must point at its object
    const s = pdf.toString('latin1');
    const xref = s.slice(s.lastIndexOf('\nxref\n'));
    const offsets = [...xref.matchAll(/^(\d{10}) 00000 n/gm)].map(m => Number(m[1]));
    expect(offsets.length).toBe(8);
    offsets.forEach((o, i) => expect(s.slice(o, o + 10)).toMatch(new RegExp(`^${i + 1} 0 obj`)));
};

describe('Job receipt PDF', () => {
    it('gives the customer a branded PDF with the charge breakdown', async () => {
        const customer = await createTestUser({ role: 'CUSTOMER', email: 'rp-c@test.com', phone: '5555555555', name: 'Ganshyam' });
        const worker = await createTestUser({ role: 'WORKER', email: 'rp-w@test.com', phone: '6666666666', name: 'Shyam Dev' });
        const job = await Job.create({
            customerId: customer._id, workerId: worker._id, category: 'Plumbing', subcategory: 'Tap repair',
            status: 'CLOSED', location: { type: 'Point', coordinates: [72.58, 23.05] },
            payment: { amount: 473.6, workerPayout: 450, platformFee: 20, gst: 3.6, status: 'PAID', method: 'WALLET' }
        });

        const res = await request(app).get(`/api/v1/customers/jobs/${job._id}/receipt-pdf`)
            .set('Authorization', `Bearer ${generateToken(customer)}`);
        expect(res.status).toBe(200);
        expect(res.body.data.fileName).toMatch(/^Kwickly_Receipt_KW-JOB-[A-F0-9]{8}\.pdf$/);

        const pdf = Buffer.from(res.body.data.pdfBase64, 'base64');
        expectValidPdf(pdf);
        const text = pageText(pdf);
        expect(text).toContain('PAYMENT RECEIPT');
        expect(text).toContain('Ganshyam');
        expect(text).toContain('Shyam Dev');
        expect(text).toContain('Plumbing - Tap repair');
        expect(text).toContain('Kwickly Wallet');
        expect(text).toContain('Rs. 473.60');
        expect(text).toContain('Rs. 450.00');
    });

    it('refuses another customer', async () => {
        const owner = await createTestUser({ role: 'CUSTOMER', email: 'rp-o@test.com', phone: '7777777777' });
        const other = await createTestUser({ role: 'CUSTOMER', email: 'rp-x@test.com', phone: '8888888888' });
        const job = await Job.create({
            customerId: owner._id, category: 'Plumbing', status: 'PAID',
            location: { type: 'Point', coordinates: [72.58, 23.05] }
        });
        const res = await request(app).get(`/api/v1/customers/jobs/${job._id}/receipt-pdf`)
            .set('Authorization', `Bearer ${generateToken(other)}`);
        expect(res.status).toBe(403);
    });
});

describe('Wallet transaction receipt PDF', () => {
    it('shows the balance after that transaction, not the current balance', async () => {
        const worker = await createTestUser({ role: 'WORKER', email: 'rw-w@test.com', phone: '9999999999', name: 'Shyam Dev' });
        const txn = await WalletTxn.create({
            userId: worker._id, type: 'JOB_CREDIT', amount: 450, balance: 1250,
            refId: '65f0c0ffee0000000000abcd', description: 'Earnings for Plumbing job'
        });
        await WalletTxn.create({ userId: worker._id, type: 'JOB_CREDIT', amount: 100, balance: 1350 });

        const res = await request(app).get(`/api/v1/wallet/transactions/${txn._id}/receipt-pdf`)
            .set('Authorization', `Bearer ${generateToken(worker)}`);
        expect(res.status).toBe(200);
        const pdf = Buffer.from(res.body.data.pdfBase64, 'base64');
        expectValidPdf(pdf);
        const text = pageText(pdf);
        expect(text).toContain('TRANSACTION RECEIPT');
        expect(text).toContain('CREDITED');
        expect(text).toContain('Job earnings');
        expect(text).toContain('Wallet balance after this transaction: Rs. 1,250.00');
        expect(text).toContain('#0000ABCD');
        expect(text).not.toMatch(/SECURE LEDGER|100% VERIFIED/);
    });

    it('refuses someone else\'s transaction', async () => {
        const a = await createTestUser({ role: 'WORKER', email: 'rw-a@test.com', phone: '1212121212' });
        const b = await createTestUser({ role: 'WORKER', email: 'rw-b@test.com', phone: '1313131313' });
        const txn = await WalletTxn.create({ userId: a._id, type: 'WITHDRAWAL', amount: 100, balance: 0 });
        const res = await request(app).get(`/api/v1/wallet/transactions/${txn._id}/receipt-pdf`)
            .set('Authorization', `Bearer ${generateToken(b)}`);
        expect(res.status).toBe(403);
    });
});
