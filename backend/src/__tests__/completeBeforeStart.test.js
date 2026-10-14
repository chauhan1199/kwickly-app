const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Job = require('../modules/job/job.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Worker cannot skip the arrival OTP', () => {
    let workerToken, job;

    beforeEach(async () => {
        const customer = await createTestUser({ role: 'CUSTOMER', email: 'cb-c@test.com', phone: '1111111111' });
        const worker = await createTestUser({
            role: 'WORKER', email: 'cb-w@test.com', phone: '2222222222', kyc: { status: 'APPROVED' }
        });
        workerToken = generateToken(worker);
        job = await Job.create({
            customerId: customer._id, workerId: worker._id, category: 'Plumbing',
            status: 'ALLOCATED', location: { type: 'Point', coordinates: [72.581, 23.051] },
            security: { arrivalOtp: '1234', completionOtp: '5678' }
        });
    });

    const getJob = () => request(app).get(`/api/v1/jobs/${job._id}`).set('Authorization', `Bearer ${workerToken}`);

    it('hides the completion PIN until the job is in progress', async () => {
        let res = await getJob();
        expect(res.status).toBe(200);
        expect(res.body.data.security?.completionOtp).toBeUndefined();
        expect(res.body.data.security?.arrivalOtp).toBeUndefined();

        await Job.updateOne({ _id: job._id }, { status: 'IN_PROGRESS' });
        res = await getJob();
        expect(res.body.data.security.completionOtp).toBe('5678');
    });

    it('explains that the job must be started before it can be completed', async () => {
        const res = await request(app).post(`/api/v1/jobs/${job._id}/complete`)
            .set('Authorization', `Bearer ${workerToken}`).send({ report: 'done' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/arrival OTP/);
        expect((await Job.findById(job._id)).status).toBe('ALLOCATED');
    });
});
