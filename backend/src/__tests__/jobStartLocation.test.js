const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Job = require('../modules/job/job.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('POST /jobs/:id/start validates the worker coordinates', () => {
    let workerToken, job;

    beforeEach(async () => {
        const customer = await createTestUser({ role: 'CUSTOMER', email: 'sl-c@test.com', phone: '1111111111' });
        const worker = await createTestUser({
            role: 'WORKER', email: 'sl-w@test.com', phone: '2222222222', kyc: { status: 'APPROVED' }
        });
        workerToken = generateToken(worker);
        job = await Job.create({
            customerId: customer._id, workerId: worker._id, category: 'Plumbing',
            status: 'ARRIVING', location: { type: 'Point', coordinates: [72.581, 23.051] },
            security: { arrivalOtp: '1234', completionOtp: '5678' }
        });
    });

    const start = (body) => request(app).post(`/api/v1/jobs/${job._id}/start`)
        .set('Authorization', `Bearer ${workerToken}`).send(body);

    it.each([
        ['non-numeric strings', ['abc', 'def']],
        ['nulls (NaN after JSON)', [null, null]],
        ['out-of-range longitude', [272.581, 23.051]],
        ['out-of-range latitude', [72.581, 123.051]],
        ['a single number', [72.581]],
    ])('rejects %s without starting the job', async (_label, currentCoordinates) => {
        const res = await start({ arrivalOtp: '1234', currentCoordinates });
        expect(res.status).toBe(400);
        expect((await Job.findById(job._id)).status).toBe('ARRIVING');
    });

    it('rejects a missing location', async () => {
        const res = await start({ arrivalOtp: '1234' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/location/i);
    });

    it('still enforces the 200 m geofence for valid but distant coordinates', async () => {
        const res = await start({ arrivalOtp: '1234', currentCoordinates: [72.70, 23.10] });
        expect(res.status).toBe(403);
    });

    it('starts the job when the worker is at the address', async () => {
        const res = await start({ arrivalOtp: '1234', currentCoordinates: [72.5811, 23.0511], accuracy: 12 });
        expect(res.status).toBe(200);
        expect((await Job.findById(job._id)).status).toBe('IN_PROGRESS');
    });
});
