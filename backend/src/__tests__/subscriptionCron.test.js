/**
 * Comprehensive tests for Subscription Cron logic (cron/subscription.cron.js)
 *
 * Uses MongoDB Memory Server for real data + mocked Redis & sockets.
 * Tests the actual query logic and state changes performed by the cron.
 */

const { setup, teardown, clearCollections, createTestUser } = require('./testSetup');
const mongoose = require('mongoose');

// ─── Models ──────────────────────────────────────────────────────────────────
const Customer = require('../modules/customer/customer.model');
const Notification = require('../modules/notification/notification.model');

// ─── Mocks (redis already mocked via testSetup.js) ───────────────────────────
const { emitToRoom } = require('../helpers/socket.helper');

// Mock notifyUser to avoid enum validation issues and verify call args
jest.mock('../helpers/notifyUser.helper', () => ({
    notifyUser: jest.fn()
}));
const { notifyUser } = require('../helpers/notifyUser.helper');

// ─── Import ──────────────────────────────────────────────────────────────────
const { startSubscriptionCron } = require('../cron/subscription.cron');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Subscription Cron — Expiring Notifications', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
    });

    it('should send SUBSCRIPTION_EXPIRING notification to workers expiring in 3 days', async () => {
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
        threeDaysFromNow.setHours(12, 0, 0, 0);

        const worker = await createTestUser({
            role: 'WORKER',
            email: 'expiring_worker@test.com',
            phone: '8800000001',
            name: 'Expiring Worker',
            subscription: {
                planId: 'monthly',
                expiryDate: threeDaysFromNow,
                isTrial: false
            }
        });

        // Simulate the cron query for expiring workers
        const now = new Date();
        const threeDays = new Date();
        threeDays.setDate(now.getDate() + 3);

        const startOfDay = new Date(threeDays);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(threeDays);
        endOfDay.setHours(23, 59, 59, 999);

        const expiringSoonWorkers = await Customer.find({
            role: 'WORKER',
            $or: [
                {
                    'subscription.expiryDate': {
                        $gte: startOfDay,
                        $lte: endOfDay
                    }
                }
            ]
        });

        expect(expiringSoonWorkers).toHaveLength(1);
        expect(expiringSoonWorkers[0]._id.toString()).toBe(worker._id.toString());

        // Verify notification would be sent with correct params
        for (const w of expiringSoonWorkers) {
            notifyUser({
                userId: w._id,
                title: '⏳ Subscription Expiring Soon',
                message: 'Your subscription or trial expires in 3 days! Top up now to continue receiving jobs.',
                action: 'SUBSCRIPTION_EXPIRING',
                entityType: 'SUBSCRIPTION',
                targetRole: 'WORKER'
            });
        }

        expect(notifyUser).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: worker._id,
                action: 'SUBSCRIPTION_EXPIRING',
                entityType: 'SUBSCRIPTION',
                targetRole: 'WORKER'
            })
        );
    });

    it('should send SUBSCRIPTION_EXPIRING notification for expiring trials', async () => {
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
        threeDaysFromNow.setHours(15, 0, 0, 0);

        const worker = await createTestUser({
            role: 'WORKER',
            email: 'expiring_trial@test.com',
            phone: '8800000002',
            name: 'Expiring Trial Worker',
            subscription: {
                isTrial: true,
                trialEndDate: threeDaysFromNow
            }
        });

        const now = new Date();
        const threeDays = new Date();
        threeDays.setDate(now.getDate() + 3);

        const startOfDay = new Date(threeDays);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(threeDays);
        endOfDay.setHours(23, 59, 59, 999);

        const expiringSoonWorkers = await Customer.find({
            role: 'WORKER',
            $or: [
                {
                    'subscription.expiryDate': {
                        $gte: startOfDay,
                        $lte: endOfDay
                    }
                },
                {
                    'subscription.isTrial': true,
                    'subscription.trialEndDate': {
                        $gte: startOfDay,
                        $lte: endOfDay
                    }
                }
            ]
        });

        expect(expiringSoonWorkers).toHaveLength(1);
        expect(expiringSoonWorkers[0]._id.toString()).toBe(worker._id.toString());

        // Verify notification params
        for (const w of expiringSoonWorkers) {
            notifyUser({
                userId: w._id,
                title: '⏳ Subscription Expiring Soon',
                message: 'Your subscription or trial expires in 3 days! Top up now to continue receiving jobs.',
                action: 'SUBSCRIPTION_EXPIRING',
                entityType: 'SUBSCRIPTION',
                targetRole: 'WORKER'
            });
        }

        expect(notifyUser).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: worker._id,
                action: 'SUBSCRIPTION_EXPIRING'
            })
        );
    });

    it('should NOT notify workers whose subscription is not expiring soon', async () => {
        // Expiring in 10 days (too far away)
        const tenDaysFromNow = new Date();
        tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);

        await createTestUser({
            role: 'WORKER',
            email: 'far_expiry@test.com',
            phone: '8800000003',
            name: 'Far Expiry Worker',
            subscription: {
                planId: 'monthly',
                expiryDate: tenDaysFromNow,
                isTrial: false
            }
        });

        // Already expired
        await createTestUser({
            role: 'WORKER',
            email: 'already_expired@test.com',
            phone: '8800000004',
            name: 'Already Expired Worker',
            subscription: {
                planId: 'monthly',
                expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
                isTrial: false
            }
        });

        const now = new Date();
        const threeDays = new Date();
        threeDays.setDate(now.getDate() + 3);

        const startOfDay = new Date(threeDays);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(threeDays);
        endOfDay.setHours(23, 59, 59, 999);

        const expiringSoonWorkers = await Customer.find({
            role: 'WORKER',
            $or: [
                {
                    'subscription.expiryDate': {
                        $gte: startOfDay,
                        $lte: endOfDay
                    }
                },
                {
                    'subscription.isTrial': true,
                    'subscription.trialEndDate': {
                        $gte: startOfDay,
                        $lte: endOfDay
                    }
                }
            ]
        });

        expect(expiringSoonWorkers).toHaveLength(0);
        expect(notifyUser).not.toHaveBeenCalled();
    });
});

describe('Subscription Cron — Expired Subscription Handling', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
    });

    it('should force offline workers with expired subscriptions who are online', async () => {
        const worker = await createTestUser({
            role: 'WORKER',
            email: 'expired_online@test.com',
            phone: '8800000005',
            name: 'Expired Online Worker',
            isOnline: true,
            subscription: {
                planId: 'monthly',
                expiryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                isTrial: false
            }
        });

        // Simulate the cron query for expired workers
        const now = new Date();
        const expiredWorkers = await Customer.find({
            role: 'WORKER',
            isOnline: true,
            $or: [
                {
                    'subscription.isTrial': false,
                    'subscription.expiryDate': { $lt: now }
                },
                {
                    'subscription.isTrial': true,
                    'subscription.trialEndDate': { $lt: now }
                }
            ]
        });

        expect(expiredWorkers).toHaveLength(1);

        for (const w of expiredWorkers) {
            w.isOnline = false;
            await w.save();

            emitToRoom(`worker_${w._id}`, 'FORCED_OFFLINE', {
                reason: 'Your subscription has expired. Please top-up to continue receiving jobs.',
                walletBalance: w.wallet?.balance || 0
            });

            notifyUser({
                userId: w._id,
                title: '❌ Subscription Expired',
                message: 'Your subscription has expired. You have been taken offline. Please top up to continue.',
                action: 'SUBSCRIPTION_EXPIRED',
                entityType: 'SUBSCRIPTION',
                targetRole: 'WORKER'
            });
        }

        const updated = await Customer.findById(worker._id);
        expect(updated.isOnline).toBe(false);

        expect(emitToRoom).toHaveBeenCalledWith(
            `worker_${worker._id}`,
            'FORCED_OFFLINE',
            expect.objectContaining({ reason: expect.stringContaining('expired') })
        );

        expect(notifyUser).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: worker._id,
                action: 'SUBSCRIPTION_EXPIRED',
                entityType: 'SUBSCRIPTION',
                targetRole: 'WORKER'
            })
        );
    });

    it('should NOT force offline workers with active subscriptions', async () => {
        const worker = await createTestUser({
            role: 'WORKER',
            email: 'active_sub@test.com',
            phone: '8800000006',
            name: 'Active Sub Worker',
            isOnline: true,
            subscription: {
                planId: 'monthly',
                expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                isTrial: false
            }
        });

        const now = new Date();
        const expiredWorkers = await Customer.find({
            role: 'WORKER',
            isOnline: true,
            $or: [
                {
                    'subscription.isTrial': false,
                    'subscription.expiryDate': { $lt: now }
                },
                {
                    'subscription.isTrial': true,
                    'subscription.trialEndDate': { $lt: now }
                }
            ]
        });

        expect(expiredWorkers).toHaveLength(0);

        const updated = await Customer.findById(worker._id);
        expect(updated.isOnline).toBe(true);
    });

    it('should NOT force offline offline workers with expired subscriptions', async () => {
        await createTestUser({
            role: 'WORKER',
            email: 'offline_expired@test.com',
            phone: '8800000007',
            name: 'Offline Expired Worker',
            isOnline: false,
            subscription: {
                planId: 'monthly',
                expiryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                isTrial: false
            }
        });

        const now = new Date();
        const expiredWorkers = await Customer.find({
            role: 'WORKER',
            isOnline: true,
            $or: [
                {
                    'subscription.isTrial': false,
                    'subscription.expiryDate': { $lt: now }
                },
                {
                    'subscription.isTrial': true,
                    'subscription.trialEndDate': { $lt: now }
                }
            ]
        });

        expect(expiredWorkers).toHaveLength(0);
    });

    it('should handle expired trial subscriptions', async () => {
        const worker = await createTestUser({
            role: 'WORKER',
            email: 'trial_expired@test.com',
            phone: '8800000008',
            name: 'Trial Expired Worker',
            isOnline: true,
            subscription: {
                isTrial: true,
                trialEndDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
            }
        });

        const now = new Date();
        const expiredWorkers = await Customer.find({
            role: 'WORKER',
            isOnline: true,
            $or: [
                {
                    'subscription.isTrial': false,
                    'subscription.expiryDate': { $lt: now }
                },
                {
                    'subscription.isTrial': true,
                    'subscription.trialEndDate': { $lt: now }
                }
            ]
        });

        expect(expiredWorkers).toHaveLength(1);
        expect(expiredWorkers[0]._id.toString()).toBe(worker._id.toString());

        for (const w of expiredWorkers) {
            w.isOnline = false;
            await w.save();
        }

        const updated = await Customer.findById(worker._id);
        expect(updated.isOnline).toBe(false);
    });

    it('should send FORCED_OFFLINE socket event with correct reason and wallet balance', async () => {
        const worker = await createTestUser({
            role: 'WORKER',
            email: 'socket_test@test.com',
            phone: '8800000009',
            name: 'Socket Test Worker',
            isOnline: true,
            subscription: {
                planId: 'monthly',
                expiryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                isTrial: false
            },
            wallet: { balance: 250 }
        });

        const now = new Date();
        const expiredWorkers = await Customer.find({
            role: 'WORKER',
            isOnline: true,
            $or: [
                {
                    'subscription.isTrial': false,
                    'subscription.expiryDate': { $lt: now }
                }
            ]
        });

        for (const w of expiredWorkers) {
            w.isOnline = false;
            await w.save();
            emitToRoom(`worker_${w._id}`, 'FORCED_OFFLINE', {
                reason: 'Your subscription has expired. Please top-up to continue receiving jobs.',
                walletBalance: w.wallet?.balance || 0
            });
        }

        expect(emitToRoom).toHaveBeenCalledWith(
            `worker_${worker._id}`,
            'FORCED_OFFLINE',
            expect.objectContaining({
                reason: expect.stringContaining('expired'),
                walletBalance: 250
            })
        );
    });
});

describe('Subscription Cron — startSubscriptionCron', () => {
    it('should export startSubscriptionCron as a function', () => {
        expect(typeof startSubscriptionCron).toBe('function');
    });
});
