const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Dispute = require('../modules/dispute/dispute.model');
const Job = require('../modules/job/job.model');
const Customer = require('../modules/customer/customer.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Dispute Routes (Admin)', () => {
    let adminToken, customerToken, workerToken;
    let adminUser, customerUser, workerUser;
    let testJob, testDispute;

    beforeEach(async () => {
        adminUser = await createTestUser({ role: 'ADMIN', email: 'disputeadmin@test.com', phone: '1234567890' });
        adminToken = generateToken(adminUser);

        customerUser = await createTestUser({ role: 'CUSTOMER', email: 'disputecustomer@test.com', phone: '1234567891', name: 'Test Customer' });
        customerToken = generateToken(customerUser);

        workerUser = await createTestUser({ role: 'CUSTOMER', email: 'disputeworker@test.com', phone: '1234567892', name: 'Test Worker' });
        workerToken = generateToken(workerUser);

        testJob = await Job.create({
            customerId: customerUser._id,
            workerId: workerUser._id,
            category: 'Plumbing',
            description: 'Fix leaky faucet',
            status: 'COMPLETED',
            location: { type: 'Point', coordinates: [77.1025, 28.7041] },
            addressDetails: { city: 'Delhi', fullAddress: '123 Test Street' },
            payment: { amount: 500, platformFee: 50, gst: 9, workerPayout: 441, status: 'PAID' }
        });

        testDispute = await Dispute.create({
            jobId: testJob._id,
            customerId: customerUser._id,
            workerId: workerUser._id,
            issue: 'Worker did not complete the work properly',
            reason: 'Incomplete work',
            description: 'The faucet is still leaking after the repair',
            status: 'OPEN'
        });
    });

    describe('GET /api/v1/admin/disputes', () => {
        it('should return disputes list for admin', async () => {
            const res = await request(app)
                .get('/api/v1/admin/disputes')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app).get('/api/v1/admin/disputes');
            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .get('/api/v1/admin/disputes')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('PATCH /api/v1/admin/disputes/:id/status', () => {
        it('should update status to in_review', async () => {
            const res = await request(app)
                .patch(`/api/v1/admin/disputes/${testDispute._id}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'IN_REVIEW' });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('IN_REVIEW');
        });

        it('should update status to resolved with resolution notes', async () => {
            const res = await request(app)
                .patch(`/api/v1/admin/disputes/${testDispute._id}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'RESOLVED', resolutionNotes: 'Issue verified and resolved with full refund' });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('RESOLVED');
            expect(res.body.data.resolutionNotes).toBe('Issue verified and resolved with full refund');
            expect(res.body.data.resolvedAt).toBeDefined();
        });

        it('should update status to refunded with refundAmount', async () => {
            const res = await request(app)
                .patch(`/api/v1/admin/disputes/${testDispute._id}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'REFUNDED', resolutionNotes: 'Customer refunded', refundAmount: 500 });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('REFUNDED');
            expect(res.body.data.resolvedAt).toBeDefined();

            // Verify customer wallet was credited
            const customer = await Customer.findById(customerUser._id);
            expect(customer.wallet.balance).toBe(500);
        });

        it('should return 404 for non-existent dispute', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .patch(`/api/v1/admin/disputes/${fakeId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'RESOLVED' });

            expect(res.status).toBe(404);
        });

        it('should return 409 when trying to refund already-refunded dispute', async () => {
            // First refund
            await request(app)
                .patch(`/api/v1/admin/disputes/${testDispute._id}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'REFUNDED', refundAmount: 500 });

            // Second refund attempt
            const res = await request(app)
                .patch(`/api/v1/admin/disputes/${testDispute._id}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'REFUNDED', refundAmount: 500 });

            expect(res.status).toBe(409);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .patch(`/api/v1/admin/disputes/${testDispute._id}/status`)
                .send({ status: 'RESOLVED' });

            expect(res.status).toBe(401);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .patch(`/api/v1/admin/disputes/${testDispute._id}/status`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ status: 'RESOLVED' });

            expect(res.status).toBe(403);
        });

        it('should update status to dismissed', async () => {
            const res = await request(app)
                .patch(`/api/v1/admin/disputes/${testDispute._id}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'DISMISSED', resolution: 'Customer complaint unfounded' });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('DISMISSED');
            expect(res.body.data.resolutionNotes).toBe('Customer complaint unfounded');
            expect(res.body.data.resolvedAt).toBeDefined();
        });
    });
});
