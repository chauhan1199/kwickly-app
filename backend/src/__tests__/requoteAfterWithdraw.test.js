const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Job = require('../modules/job/job.model');
const Quote = require('../modules/quote/quote.model');
const Category = require('../modules/category/category.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Worker can re-quote a job after withdrawing', () => {
    let workerToken, workerId, job;

    beforeEach(async () => {
        const customer = await createTestUser({ role: 'CUSTOMER', email: 'rq-c@test.com', phone: '1111111111' });
        const cat = await Category.create({ name: 'Plumbing' });
        const worker = await createTestUser({
            role: 'WORKER', email: 'rq-w@test.com', phone: '2222222222',
            kyc: { status: 'APPROVED' }, isOnline: true, wallet: { balance: 500 },
            services: [{ category: cat._id, categoryName: 'Plumbing', isActive: true }],
            activeLocation: { type: 'Point', coordinates: [72.58, 23.05] }
        });
        workerToken = generateToken(worker);
        workerId = worker._id;
        job = await Job.create({
            customerId: customer._id, category: 'Plumbing', description: 'Tap leaking',
            status: 'BROADCASTING', location: { type: 'Point', coordinates: [72.581, 23.051] }
        });
    });

    const availableIds = async () => {
        const res = await request(app).get('/api/v1/jobs/available').set('Authorization', `Bearer ${workerToken}`);
        expect(res.status).toBe(200);
        const list = res.body.data?.jobs || res.body.data || [];
        return list.map(j => String(j._id));
    };

    it('hides a job with a pending quote, shows it again once withdrawn, and accepts a new quote', async () => {
        expect(await availableIds()).toContain(String(job._id));

        const q = await Quote.create({ jobId: job._id, workerId, amount: 300 });
        expect(await availableIds()).not.toContain(String(job._id));

        await Quote.updateOne({ _id: q._id }, { status: 'WITHDRAWN' });
        expect(await availableIds()).toContain(String(job._id));

        const res = await request(app).post('/api/v1/quotes').set('Authorization', `Bearer ${workerToken}`)
            .send({ jobId: String(job._id), amount: 450, description: 'Can come today' });
        expect([200, 201]).toContain(res.status);
        const live = await Quote.findOne({ jobId: job._id, workerId, status: 'PENDING' }).lean();
        expect(live.amount).toBe(450);
    });
});
