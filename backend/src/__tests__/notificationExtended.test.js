const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Notification = require('../modules/notification/notification.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Notification Routes — Extended', () => {
    let adminToken, customerToken, workerToken;

    beforeEach(async () => {
        const admin = await createTestUser({ role: 'ADMIN', email: 'notifextadmin@test.com', phone: '1234567890' });
        adminToken = generateToken(admin);

        const customer = await createTestUser({ role: 'CUSTOMER', email: 'notifextc@test.com', phone: '1234567891' });
        customerToken = generateToken(customer);

        const worker = await createTestUser({ role: 'WORKER', email: 'notifextw@test.com', phone: '1234567892' });
        workerToken = generateToken(worker);
    });

    describe('GET /api/v1/notifications/unread-count', () => {
        it('should return unread count of 0 when no notifications', async () => {
            const res = await request(app)
                .get('/api/v1/notifications/unread-count')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.unreadCount).toBe(0);
        });

        it('should return correct unread count for customer', async () => {
            const customer = await require('../modules/customer/customer.model').findOne({ email: 'notifextc@test.com' });

            // Create direct notification for the customer
            await Notification.create({
                userId: customer._id,
                title: 'Test Notification',
                message: 'You have a new update',
                type: 'DIRECT',
                action: 'OTHER'
            });

            const res = await request(app)
                .get('/api/v1/notifications/unread-count')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.unreadCount).toBe(1);
        });

        it('should return unread count for broadcast notifications', async () => {
            // Create broadcast for all roles
            await Notification.create({
                title: 'System Update',
                message: 'Scheduled maintenance tonight',
                type: 'BROADCAST',
                targetRole: 'ALL',
                action: 'SYSTEM'
            });

            const res = await request(app)
                .get('/api/v1/notifications/unread-count')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.unreadCount).toBe(1);
        });

        it('should exclude deleted notifications from count', async () => {
            const customer = await require('../modules/customer/customer.model').findOne({ email: 'notifextc@test.com' });

            await Notification.create({
                userId: customer._id,
                title: 'Deleted Notification',
                message: 'This was deleted',
                type: 'DIRECT',
                action: 'OTHER',
                deletedBy: [customer._id]
            });

            const res = await request(app)
                .get('/api/v1/notifications/unread-count')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.unreadCount).toBe(0);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .get('/api/v1/notifications/unread-count');

            expect(res.status).toBe(401);
        });
    });

    describe('PATCH /api/v1/notifications/:id/read', () => {
        it('should mark a direct notification as read', async () => {
            const customer = await require('../modules/customer/customer.model').findOne({ email: 'notifextc@test.com' });

            const notification = await Notification.create({
                userId: customer._id,
                title: 'Read Me',
                message: 'Mark this as read',
                type: 'DIRECT',
                action: 'OTHER'
            });

            const res = await request(app)
                .patch(`/api/v1/notifications/${notification._id}/read`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');

            // Verify it's in readBy
            const updated = await Notification.findById(notification._id);
            expect(updated.readBy.map(id => id.toString())).toContain(customer._id.toString());
        });

        it('should mark broadcast notification as read', async () => {
            await Notification.create({
                title: 'Broadcast',
                message: 'Important update',
                type: 'BROADCAST',
                targetRole: 'ALL',
                action: 'SYSTEM'
            });

            const notification = await Notification.findOne({ type: 'BROADCAST' });

            const res = await request(app)
                .patch(`/api/v1/notifications/${notification._id}/read`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
        });

        it('should return 404 for non-existent notification', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .patch(`/api/v1/notifications/${fakeId}/read`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .patch('/api/v1/notifications/507f1f77bcf86cd799439011/read');

            expect(res.status).toBe(401);
        });
    });

    describe('DELETE /api/v1/notifications/:id', () => {
        it('should soft-delete own notification', async () => {
            const customer = await require('../modules/customer/customer.model').findOne({ email: 'notifextc@test.com' });

            const notification = await Notification.create({
                userId: customer._id,
                title: 'Delete Me',
                message: 'This will be deleted',
                type: 'DIRECT',
                action: 'OTHER'
            });

            const res = await request(app)
                .delete(`/api/v1/notifications/${notification._id}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');

            // Verify soft-delete (deletedBy should contain userId)
            const updated = await Notification.findById(notification._id);
            expect(updated.deletedBy.map(id => id.toString())).toContain(customer._id.toString());
        });

        it('should soft-delete broadcast notification', async () => {
            await Notification.create({
                title: 'Broadcast Delete',
                message: 'Delete this broadcast',
                type: 'BROADCAST',
                targetRole: 'ALL',
                action: 'SYSTEM'
            });

            const notification = await Notification.findOne({ type: 'BROADCAST' });

            const res = await request(app)
                .delete(`/api/v1/notifications/${notification._id}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
        });

        it('should return 404 for non-existent notification', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .delete(`/api/v1/notifications/${fakeId}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .delete('/api/v1/notifications/507f1f77bcf86cd799439011');

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/v1/notifications/activity-logs', () => {
        it('should return activity logs for admin', async () => {
            // Seed some admin activity logs
            await Notification.create([
                { title: 'Customer Created', message: 'New customer registered', type: 'ADMIN_ACTIVITY', targetRole: 'ADMIN', action: 'CREATE' },
                { title: 'Product Updated', message: 'Product price changed', type: 'ADMIN_ACTIVITY', targetRole: 'ADMIN', action: 'UPDATE' }
            ]);

            const res = await request(app)
                .get('/api/v1/notifications/activity-logs')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.logs).toBeDefined();
            expect(res.body.data.total).toBeDefined();
            expect(res.body.data.page).toBeDefined();
            expect(res.body.data.totalPages).toBeDefined();
        });

        it('should support pagination params', async () => {
            const res = await request(app)
                .get('/api/v1/notifications/activity-logs')
                .query({ page: 1, limit: 10 })
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
        });

        it('should support type filter', async () => {
            await Notification.create({
                title: 'KYC Approved',
                message: 'Worker KYC approved',
                type: 'ADMIN_ACTIVITY',
                targetRole: 'ADMIN',
                action: 'KYC'
            });

            const res = await request(app)
                .get('/api/v1/notifications/activity-logs')
                .query({ type: 'kyc' })
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.logs.length).toBeGreaterThanOrEqual(1);
        });

        it('should reject non-admin user', async () => {
            const res = await request(app)
                .get('/api/v1/notifications/activity-logs')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(403);
        });

        it('should reject worker from accessing activity logs', async () => {
            const res = await request(app)
                .get('/api/v1/notifications/activity-logs')
                .set('Authorization', `Bearer ${workerToken}`);

            expect(res.status).toBe(403);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .get('/api/v1/notifications/activity-logs');

            expect(res.status).toBe(401);
        });
    });
});
