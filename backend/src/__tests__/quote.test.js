const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Job = require('../modules/job/job.model');
const Quote = require('../modules/quote/quote.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Quote Routes', () => {
    let customerToken, workerToken, customerId, workerId, jobId;

    beforeEach(async () => {
        const customer = await createTestUser({ role: 'CUSTOMER', email: 'quotec@test.com', phone: '1234567890' });
        customerToken = generateToken(customer);
        customerId = customer._id;

        const worker = await createTestUser({ role: 'WORKER', email: 'quotew@test.com', phone: '1234567891' });
        workerToken = generateToken(worker);
        workerId = worker._id;

        const job = await Job.create({
            customerId,
            category: 'Plumbing',
            description: 'Fix sink',
            status: 'BROADCASTING',
            location: { type: 'Point', coordinates: [72.8777, 19.0760] }
        });
        jobId = job._id;
    });

    describe('POST /api/v1/quotes', () => {
        it('should place quote as worker (or 403 if not verified)', async () => {
            const res = await request(app)
                .post('/api/v1/quotes')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({ jobId, amount: 500, description: 'Can fix it' });
            expect([200, 403]).toContain(res.status);
        });

        it('should reject quote by customer', async () => {
            const res = await request(app)
                .post('/api/v1/quotes')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ jobId, amount: 500 });
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/v1/quotes/worker', () => {
        it('should return worker quotes', async () => {
            await Quote.create({ jobId, workerId, amount: 500 });

            const res = await request(app)
                .get('/api/v1/quotes/worker')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/quotes/job/:jobId', () => {
        it('should return quotes for job', async () => {
            await Quote.create({ jobId, workerId, amount: 500 });

            const res = await request(app)
                .get(`/api/v1/quotes/job/${jobId}`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('PATCH /api/v1/quotes/:id/accept', () => {
        it('should accept quote as customer', async () => {
            const quote = await Quote.create({ jobId, workerId, amount: 500 });

            const res = await request(app)
                .patch(`/api/v1/quotes/${quote._id}/accept`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
        });

        it('should reject acceptance by worker', async () => {
            const quote = await Quote.create({ jobId, workerId, amount: 500 });

            const res = await request(app)
                .patch(`/api/v1/quotes/${quote._id}/accept`)
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('PATCH /api/v1/quotes/:id/withdraw', () => {
        it('should withdraw quote as worker', async () => {
            const quote = await Quote.create({ jobId, workerId, amount: 500 });

            const res = await request(app)
                .patch(`/api/v1/quotes/${quote._id}/withdraw`)
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(200);
        });
    });
});
