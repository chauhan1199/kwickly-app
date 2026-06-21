const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Job = require('../modules/job/job.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Job Routes', () => {
    let customerToken, workerToken, adminToken, customerId, workerId;

    beforeEach(async () => {
        const customer = await createTestUser({ role: 'CUSTOMER', email: 'jobcustomer@test.com', phone: '1234567890' });
        customerToken = generateToken(customer);
        customerId = customer._id;

        const worker = await createTestUser({ role: 'WORKER', email: 'jobworker@test.com', phone: '1234567891' });
        workerToken = generateToken(worker);
        workerId = worker._id;

        const admin = await createTestUser({ role: 'ADMIN', email: 'jobadmin@test.com', phone: '1234567892' });
        adminToken = generateToken(admin);
    });

    describe('POST /api/v1/jobs', () => {
        it('should create a job as customer', async () => {
            const res = await request(app)
                .post('/api/v1/jobs')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    category: 'Plumbing',
                    description: 'Fix kitchen sink',
                    location: { type: 'Point', coordinates: [72.8777, 19.0760] }
                });
            expect(res.status).toBe(201);
            expect(res.body.data).toBeDefined();
        });

        it('should reject job creation without required fields', async () => {
            const res = await request(app)
                .post('/api/v1/jobs')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ description: 'Fix sink' });
            expect(res.status).toBe(400);
        });

        it('should reject job creation by worker', async () => {
            const res = await request(app)
                .post('/api/v1/jobs')
                .set('Authorization', `Bearer ${workerToken}`)
                .send({
                    category: 'Plumbing',
                    location: { type: 'Point', coordinates: [72.8777, 19.0760] }
                });
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/v1/jobs/my', () => {
        it('should return customer jobs', async () => {
            await Job.create({
                customerId,
                category: 'Plumbing',
                description: 'Test job',
                location: { type: 'Point', coordinates: [72.8777, 19.0760] }
            });

            const res = await request(app)
                .get('/api/v1/jobs/my')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
        });

        it('should reject non-customer accessing customer jobs', async () => {
            const res = await request(app)
                .get('/api/v1/jobs/my')
                .set('Authorization', `Bearer ${workerToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/v1/jobs/available', () => {
        it('should return available jobs for worker (or 403 if not verified)', async () => {
            await Job.create({
                customerId,
                category: 'Plumbing',
                description: 'Broadcasting job',
                status: 'BROADCASTING',
                location: { type: 'Point', coordinates: [72.8777, 19.0760] }
            });

            const res = await request(app)
                .get('/api/v1/jobs/available')
                .set('Authorization', `Bearer ${workerToken}`);
            expect([200, 403]).toContain(res.status);
        });
    });

    describe('GET /api/v1/jobs/all (Admin)', () => {
        it('should return all jobs for admin', async () => {
            await Job.create({
                customerId,
                category: 'Plumbing',
                description: 'Test job',
                location: { type: 'Point', coordinates: [72.8777, 19.0760] }
            });

            const res = await request(app)
                .get('/api/v1/jobs/all')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });

        it('should reject non-admin accessing all jobs', async () => {
            const res = await request(app)
                .get('/api/v1/jobs/all')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('PATCH /api/v1/jobs/:id/cancel', () => {
        it('should cancel job as customer', async () => {
            const job = await Job.create({
                customerId,
                category: 'Plumbing',
                description: 'Cancel me',
                status: 'BROADCASTING',
                location: { type: 'Point', coordinates: [72.8777, 19.0760] }
            });

            const res = await request(app)
                .patch(`/api/v1/jobs/${job._id}/cancel`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
        });
    });
});
