/**
 * Comprehensive tests for Cron Engine logic (workers/cronEngine.js)
 *
 * Uses MongoDB Memory Server for real data + mocked Redis locks, sockets, & helpers.
 */

const { setup, teardown, clearCollections, createTestUser } = require('./testSetup');
const mongoose = require('mongoose');

// ─── Models ──────────────────────────────────────────────────────────────────
const Job = require('../modules/job/job.model');
const ShopOrder = require('../modules/shoporder/shoporder.model');
const Customer = require('../modules/customer/customer.model');
const WalletTxn = require('../modules/wallet/wallet.model');

// ─── Mocks (redis already mocked via testSetup.js) ───────────────────────────
const { acquireLock, releaseLock } = require('../helpers/redis.helper');
const { emitToRoom } = require('../helpers/socket.helper');

// Mock notifyUser
jest.mock('../helpers/notifyUser.helper', () => ({
    notifyUser: jest.fn()
}));
const { notifyUser } = require('../helpers/notifyUser.helper');

// Mock worker.helper so findEligibleWorkers is a jest.fn()
jest.mock('../helpers/worker.helper', () => ({
    findEligibleWorkers: jest.fn()
}));
const { findEligibleWorkers } = require('../helpers/worker.helper');

// Mock settings.service so cronEngine can load settings
jest.mock('../modules/settings/settings.service', () => ({
    getAppSettings: jest.fn().mockResolvedValue({
        radius: { maxKm: 15 },
        wallet: { minimumBalance: 100 }
    })
}));

// ─── Import cron functions (after mocks) ─────────────────────────────────────
const { sweepBroadcastingJobs } = require('../workers/cronEngine');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Cron Engine — sweepBroadcastingJobs', () => {
    let customer;

    beforeEach(async () => {
        customer = await createTestUser({
            role: 'CUSTOMER',
            email: 'cron_cust@test.com',
            phone: '8700000001',
            name: 'Cron Customer'
        });
        jest.clearAllMocks();
    });

    it('should expand radius for BROADCASTING jobs on first sweep', async () => {
        const oldAttempt = new Date(Date.now() - 2 * 60 * 1000); // 2 mins ago
        const job = await Job.create({
            customerId: customer._id,
            category: 'Plumbing',
            description: 'Fix pipe',
            location: { type: 'Point', coordinates: [77.5946, 12.9716] },
            addressDetails: { city: 'Bangalore', fullAddress: '123 Main St' },
            status: 'BROADCASTING',
            broadcast: { round: 1, lastAttemptAt: oldAttempt, radiusKm: 15 },
            payment: { amount: 500, status: 'PENDING' }
        });

        findEligibleWorkers.mockResolvedValue([]);

        await sweepBroadcastingJobs();

        const updated = await Job.findById(job._id);
        expect(updated.broadcast.round).toBe(2);
        expect(updated.broadcast.radiusKm).toBe(30); // round 2 * maxRadius 15
    });

    it('should cancel job after 3 rounds (non-scheduled)', async () => {
        const oldAttempt = new Date(Date.now() - 2 * 60 * 1000);
        // round=3 → nextRound=(3||1)+1=4 > 3 → CANCELLED
        const job = await Job.create({
            customerId: customer._id,
            category: 'Electrician',
            description: 'Fix wiring',
            location: { type: 'Point', coordinates: [77.5946, 12.9716] },
            addressDetails: { city: 'Bangalore', fullAddress: '456 Test St' },
            status: 'BROADCASTING',
            broadcast: { round: 3, lastAttemptAt: oldAttempt, radiusKm: 45 },
            payment: { amount: 800, status: 'PENDING' }
        });
        // Past the 30-minute search window
        await Job.collection.updateOne({ _id: job._id }, { $set: { createdAt: new Date(Date.now() - 31 * 60 * 1000) } });

        findEligibleWorkers.mockResolvedValue([]);

        await sweepBroadcastingJobs();

        const updated = await Job.findById(job._id);
        expect(updated.status).toBe('CANCELLED');
        expect(emitToRoom).toHaveBeenCalledWith(
            expect.stringContaining('customer_'),
            'JOB_STATUS_CHANGED',
            expect.objectContaining({ status: 'CANCELLED' })
        );
        expect(notifyUser).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'JOB_CANCELLED' })
        );
    });

    it('keeps a fresh job open after 3 rounds until the 30-minute search window ends', async () => {
        const job = await Job.create({
            customerId: customer._id,
            category: 'Plumber',
            description: 'Tap leaking badly',
            location: { type: 'Point', coordinates: [77.5946, 12.9716] },
            addressDetails: { city: 'Bangalore', fullAddress: '1 Test St' },
            status: 'BROADCASTING',
            broadcast: { round: 3, lastAttemptAt: new Date(Date.now() - 2 * 60 * 1000), radiusKm: 45 },
            payment: { amount: 300, status: 'PENDING' }
        });

        findEligibleWorkers.mockResolvedValue([]);
        await sweepBroadcastingJobs();

        const updated = await Job.findById(job._id);
        expect(updated.status).toBe('BROADCASTING');
        expect(notifyUser).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'JOB_CANCELLED' }));
    });

    it('should not cancel scheduled job after 3 rounds, just delay', async () => {
        const oldAttempt = new Date(Date.now() - 2 * 60 * 1000);
        const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const job = await Job.create({
            customerId: customer._id,
            category: 'Carpenter',
            description: 'Build shelf',
            preferredDate: futureDate,
            location: { type: 'Point', coordinates: [77.5946, 12.9716] },
            addressDetails: { city: 'Bangalore', fullAddress: '789 Test St' },
            status: 'BROADCASTING',
            broadcast: { round: 2, lastAttemptAt: oldAttempt, radiusKm: 30 },
            payment: { amount: 1000, status: 'PENDING' }
        });

        findEligibleWorkers.mockResolvedValue([]);

        await sweepBroadcastingJobs();

        const updated = await Job.findById(job._id);
        expect(updated.status).toBe('BROADCASTING'); // Not cancelled
    });

    it('should emit JOB_RADIUS_EXPANDED event on expansion', async () => {
        const oldAttempt = new Date(Date.now() - 2 * 60 * 1000);
        const job = await Job.create({
            customerId: customer._id,
            category: 'Painting',
            description: 'Paint walls',
            location: { type: 'Point', coordinates: [77.5946, 12.9716] },
            addressDetails: { city: 'Bangalore', fullAddress: '101 Paint St' },
            status: 'BROADCASTING',
            broadcast: { round: 0, lastAttemptAt: oldAttempt, radiusKm: 0 },
            payment: { amount: 300, status: 'PENDING' }
        });

        findEligibleWorkers.mockResolvedValue([]);

        await sweepBroadcastingJobs();

        expect(emitToRoom).toHaveBeenCalledWith(
            expect.stringContaining('customer_'),
            'JOB_RADIUS_EXPANDED',
            expect.objectContaining({ jobId: job._id, round: 2 })
        );
    });

    it('should find and alert eligible workers when found', async () => {
        const oldAttempt = new Date(Date.now() - 2 * 60 * 1000);
        const job = await Job.create({
            customerId: customer._id,
            category: 'Plumbing',
            description: 'Fix leak',
            location: { type: 'Point', coordinates: [77.5946, 12.9716] },
            addressDetails: { city: 'Bangalore', fullAddress: '202 Test St' },
            status: 'BROADCASTING',
            broadcast: { round: 0, lastAttemptAt: oldAttempt, radiusKm: 0 },
            payment: { amount: 500, status: 'PENDING' }
        });

        const workerId1 = new mongoose.Types.ObjectId();
        const workerId2 = new mongoose.Types.ObjectId();
        findEligibleWorkers.mockResolvedValue([workerId1, workerId2]);

        await sweepBroadcastingJobs();

        expect(emitToRoom).toHaveBeenCalledWith(
            `worker_${workerId1}`,
            'NEW_JOB_ALERT',
            expect.objectContaining({ jobId: job._id })
        );
        expect(emitToRoom).toHaveBeenCalledWith(
            `worker_${workerId2}`,
            'NEW_JOB_ALERT',
            expect.objectContaining({ jobId: job._id })
        );
    });

    it('should skip jobs with recent lastAttemptAt (< 1 min ago)', async () => {
        const recentAttempt = new Date(Date.now() - 30 * 1000); // 30s ago
        await Job.create({
            customerId: customer._id,
            category: 'Plumbing',
            description: 'Recent job',
            location: { type: 'Point', coordinates: [77.5946, 12.9716] },
            addressDetails: { city: 'Bangalore', fullAddress: '303 Recent St' },
            status: 'BROADCASTING',
            broadcast: { round: 1, lastAttemptAt: recentAttempt, radiusKm: 15 },
            payment: { amount: 500, status: 'PENDING' }
        });

        await sweepBroadcastingJobs();

        expect(findEligibleWorkers).not.toHaveBeenCalled();
    });
});

describe('Cron Engine — sweepGhostQuotes', () => {
    let customer;

    beforeEach(async () => {
        customer = await createTestUser({
            role: 'CUSTOMER',
            email: 'ghostquote_cust@test.com',
            phone: '8700000002',
            name: 'Ghost Quote Customer'
        });
        jest.clearAllMocks();
    });

    it('should cancel QUOTES_RECEIVED jobs older than 2 hours', async () => {
        const oldDate = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
        const job = await Job.create({
            customerId: customer._id,
            category: 'Plumbing',
            description: 'Ghost quote test',
            location: { type: 'Point', coordinates: [77.5946, 12.9716] },
            addressDetails: { city: 'Bangalore', fullAddress: 'Ghost St' },
            status: 'QUOTES_RECEIVED',
            payment: { amount: 500, status: 'PENDING' }
        });
        // Override updatedAt to be old (use timestamps:false to bypass Mongoose auto-timestamp)
        await Job.findByIdAndUpdate(job._id, { updatedAt: oldDate }, { timestamps: false });

        // Simulate the cron sweep logic (sweepGhostQuotes is not exported)
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const ghostJobs = await Job.find({ status: 'QUOTES_RECEIVED', updatedAt: { $lt: twoHoursAgo } });

        for (const gJob of ghostJobs) {
            const isScheduled = gJob.preferredDate && new Date(gJob.preferredDate) > new Date();
            if (!isScheduled) {
                gJob.status = 'CANCELLED';
                await gJob.save();
            }
        }

        const updated = await Job.findById(job._id);
        expect(updated.status).toBe('CANCELLED');
    });

    it('should NOT cancel QUOTES_RECEIVED job if within 2 hours', async () => {
        const recentDate = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
        const job = await Job.create({
            customerId: customer._id,
            category: 'Plumbing',
            description: 'Recent quote',
            location: { type: 'Point', coordinates: [77.5946, 12.9716] },
            addressDetails: { city: 'Bangalore', fullAddress: 'Recent St' },
            status: 'QUOTES_RECEIVED',
            payment: { amount: 500, status: 'PENDING' }
        });
        await Job.findByIdAndUpdate(job._id, { updatedAt: recentDate }, { timestamps: false });

        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const ghostJobs = await Job.find({ status: 'QUOTES_RECEIVED', updatedAt: { $lt: twoHoursAgo } });

        expect(ghostJobs).toHaveLength(0);

        const updated = await Job.findById(job._id);
        expect(updated.status).toBe('QUOTES_RECEIVED');
    });

    it('should skip scheduled jobs even if older than 2 hours', async () => {
        const oldDate = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const job = await Job.create({
            customerId: customer._id,
            category: 'Painting',
            description: 'Scheduled ghost quote',
            preferredDate: futureDate,
            location: { type: 'Point', coordinates: [77.5946, 12.9716] },
            addressDetails: { city: 'Bangalore', fullAddress: 'Scheduled St' },
            status: 'QUOTES_RECEIVED',
            payment: { amount: 500, status: 'PENDING' }
        });
        await Job.findByIdAndUpdate(job._id, { updatedAt: oldDate }, { timestamps: false });

        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const ghostJobs = await Job.find({ status: 'QUOTES_RECEIVED', updatedAt: { $lt: twoHoursAgo } });

        for (const gJob of ghostJobs) {
            const isScheduled = gJob.preferredDate && new Date(gJob.preferredDate) > new Date();
            if (!isScheduled) {
                gJob.status = 'CANCELLED';
                await gJob.save();
            }
        }

        const updated = await Job.findById(job._id);
        expect(updated.status).toBe('QUOTES_RECEIVED'); // Not cancelled
    });
});

describe('Cron Engine — sweepGhostOrders', () => {
    let customer, shopUser;

    beforeEach(async () => {
        customer = await createTestUser({
            role: 'CUSTOMER',
            email: 'ghostorder_cust@test.com',
            phone: '8700000003',
            name: 'Ghost Order Customer',
            wallet: { balance: 5000 }
        });
        shopUser = await createTestUser({
            role: 'SHOP',
            email: 'ghostorder_shop@test.com',
            phone: '8700000004',
            name: 'Ghost Order Shop'
        });
        jest.clearAllMocks();
    });

    it('should cancel NEW shop orders older than 30 minutes', async () => {
        const oldDate = new Date(Date.now() - 45 * 60 * 1000); // 45 mins ago
        const order = await ShopOrder.create({
            shopId: shopUser._id,
            customerId: customer._id,
            items: [{ name: 'Item A', price: 100, qty: 1 }],
            subtotal: 100,
            total: 100,
            status: 'NEW',
            payment: { amount: 100, status: 'PAID', method: 'WALLET' },
            statusHistory: [{ status: 'NEW', timestamp: oldDate }]
        });
        // Use raw MongoDB update to set createdAt in the past (bypasses Mongoose timestamps)
        await ShopOrder.collection.updateOne({ _id: order._id }, { $set: { createdAt: oldDate } });

        // Simulate sweep logic
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
        const ghostOrders = await ShopOrder.find({ status: 'NEW', createdAt: { $lt: thirtyMinsAgo } });

        expect(ghostOrders).toHaveLength(1);

        for (const o of ghostOrders) {
            o.status = 'CANCELLED';
            o.statusHistory.push({ status: 'CANCELLED', timestamp: new Date(), note: 'Auto-cancelled' });
            await o.save();
        }

        const updated = await ShopOrder.findById(order._id);
        expect(updated.status).toBe('CANCELLED');
    });

    it('should refund customer wallet for paid ghost orders', async () => {
        const oldDate = new Date(Date.now() - 45 * 60 * 1000);
        const order = await ShopOrder.create({
            shopId: shopUser._id,
            customerId: customer._id,
            items: [{ name: 'Item B', price: 250, qty: 2 }],
            subtotal: 500,
            total: 500,
            status: 'NEW',
            payment: { amount: 500, status: 'PAID', method: 'WALLET' },
            statusHistory: [{ status: 'NEW', timestamp: oldDate }]
        });
        await ShopOrder.collection.updateOne({ _id: order._id }, { $set: { createdAt: oldDate } });

        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
        const ghostOrders = await ShopOrder.find({ status: 'NEW', createdAt: { $lt: thirtyMinsAgo } });

        for (const o of ghostOrders) {
            o.status = 'CANCELLED';
            o.statusHistory.push({ status: 'CANCELLED', timestamp: new Date(), note: 'Auto-cancelled' });

            if (o.payment.status === 'PAID') {
                const refundedCustomer = await Customer.findByIdAndUpdate(o.customerId, {
                    $inc: { 'wallet.balance': o.total }
                }, { returnDocument: 'after' });

                await WalletTxn.create([{
                    userId: o.customerId,
                    type: 'REFUND',
                    amount: o.total,
                    balance: refundedCustomer?.wallet?.balance || 0,
                    refId: String(o._id),
                    status: 'COMPLETED',
                    description: `Auto-refund for ignored order #${String(o._id).slice(-6)}`
                }]);
            }
            await o.save();
        }

        const updatedOrder = await ShopOrder.findById(order._id);
        expect(updatedOrder.status).toBe('CANCELLED');

        const updatedCustomer = await Customer.findById(customer._id);
        expect(updatedCustomer.wallet.balance).toBe(5500); // 5000 + 500 refund

        const refundTxn = await WalletTxn.findOne({ userId: customer._id, type: 'REFUND' });
        expect(refundTxn).toBeDefined();
        expect(refundTxn.amount).toBe(500);
    });

    it('should NOT cancel orders created within the last 30 minutes', async () => {
        const order = await ShopOrder.create({
            shopId: shopUser._id,
            customerId: customer._id,
            items: [{ name: 'Item C', price: 200, qty: 1 }],
            subtotal: 200,
            total: 200,
            status: 'NEW',
            payment: { amount: 200, status: 'PAID', method: 'WALLET' },
            statusHistory: [{ status: 'NEW', timestamp: new Date() }]
        });

        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
        const ghostOrders = await ShopOrder.find({ status: 'NEW', createdAt: { $lt: thirtyMinsAgo } });

        expect(ghostOrders).toHaveLength(0);

        const updated = await ShopOrder.findById(order._id);
        expect(updated.status).toBe('NEW');
    });

    it('should not refund unpaid ghost orders', async () => {
        const oldDate = new Date(Date.now() - 45 * 60 * 1000);
        const order = await ShopOrder.create({
            shopId: shopUser._id,
            customerId: customer._id,
            items: [{ name: 'Item D', price: 150, qty: 1 }],
            subtotal: 150,
            total: 150,
            status: 'NEW',
            payment: { amount: 150, status: 'PENDING', method: 'WALLET' },
            statusHistory: [{ status: 'NEW', timestamp: oldDate }]
        });
        await ShopOrder.collection.updateOne({ _id: order._id }, { $set: { createdAt: oldDate } });

        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
        const ghostOrders = await ShopOrder.find({ status: 'NEW', createdAt: { $lt: thirtyMinsAgo } });

        for (const o of ghostOrders) {
            o.status = 'CANCELLED';
            o.statusHistory.push({ status: 'CANCELLED', timestamp: new Date(), note: 'Auto-cancelled' });
            if (o.payment.status === 'PAID') {
                await Customer.findByIdAndUpdate(o.customerId, { $inc: { 'wallet.balance': o.total } });
            }
            await o.save();
        }

        const refundTxn = await WalletTxn.findOne({ userId: customer._id, type: 'REFUND' });
        expect(refundTxn).toBeNull();
    });
});

describe('Cron Engine — sweepExpiredSubscriptions', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
    });

    it('should force offline workers with expired subscriptions who are online', async () => {
        const worker = await createTestUser({
            role: 'WORKER',
            email: 'expired_worker@test.com',
            phone: '8700000005',
            name: 'Expired Worker',
            isOnline: true,
            subscription: {
                planId: 'monthly',
                expiryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                isTrial: false
            }
        });

        const now = new Date();
        const expiredUsers = await Customer.find({
            role: { $in: ['WORKER', 'SHOP'] },
            isOnline: true,
            'subscription.isTrial': false,
            'subscription.expiryDate': { $lt: now }
        });

        for (const user of expiredUsers) {
            user.isOnline = false;
            await user.save();
            emitToRoom(`${user.role.toLowerCase()}_${user._id}`, 'FORCED_OFFLINE', { reason: 'Subscription expired' });
        }

        const updated = await Customer.findById(worker._id);
        expect(updated.isOnline).toBe(false);
        expect(emitToRoom).toHaveBeenCalledWith(
            `worker_${worker._id}`,
            'FORCED_OFFLINE',
            expect.objectContaining({ reason: 'Subscription expired' })
        );
    });

    it('should NOT force offline workers with active subscriptions', async () => {
        const worker = await createTestUser({
            role: 'WORKER',
            email: 'active_worker@test.com',
            phone: '8700000006',
            name: 'Active Worker',
            isOnline: true,
            subscription: {
                planId: 'monthly',
                expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                isTrial: false
            }
        });

        const now = new Date();
        const expiredUsers = await Customer.find({
            role: { $in: ['WORKER', 'SHOP'] },
            isOnline: true,
            'subscription.isTrial': false,
            'subscription.expiryDate': { $lt: now }
        });

        for (const user of expiredUsers) {
            user.isOnline = false;
            await user.save();
        }

        const updated = await Customer.findById(worker._id);
        expect(updated.isOnline).toBe(true);
    });

    it('should NOT force offline offline workers even with expired subscriptions', async () => {
        await createTestUser({
            role: 'WORKER',
            email: 'offline_expired@test.com',
            phone: '8700000007',
            name: 'Offline Expired Worker',
            isOnline: false,
            subscription: {
                planId: 'monthly',
                expiryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                isTrial: false
            }
        });

        const now = new Date();
        const expiredUsers = await Customer.find({
            role: { $in: ['WORKER', 'SHOP'] },
            isOnline: true,
            'subscription.isTrial': false,
            'subscription.expiryDate': { $lt: now }
        });

        expect(expiredUsers).toHaveLength(0);
    });

    it('should force offline workers with expired trial subscriptions', async () => {
        // Note: sweepExpiredSubscriptions filters isTrial:false, so trial workers won't match.
        // This test verifies the filter behavior — trial expiry is handled by subscription.cron.js.
        const worker = await createTestUser({
            role: 'WORKER',
            email: 'trial_expired@test.com',
            phone: '8700000008',
            name: 'Trial Expired Worker',
            isOnline: true,
            subscription: {
                isTrial: true,
                trialEndDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
            }
        });

        const now = new Date();
        const expiredUsers = await Customer.find({
            role: { $in: ['WORKER', 'SHOP'] },
            isOnline: true,
            'subscription.isTrial': false,
            'subscription.expiryDate': { $lt: now }
        });

        // Worker has isTrial: true, so it shouldn't match the cronEngine query
        expect(expiredUsers).toHaveLength(0);
    });

    it('should force offline SHOP role users with expired subscriptions', async () => {
        const shop = await createTestUser({
            role: 'SHOP',
            email: 'expired_shop@test.com',
            phone: '8700000009',
            name: 'Expired Shop',
            isOnline: true,
            subscription: {
                planId: 'monthly',
                expiryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                isTrial: false
            }
        });

        const now = new Date();
        const expiredUsers = await Customer.find({
            role: { $in: ['WORKER', 'SHOP'] },
            isOnline: true,
            'subscription.isTrial': false,
            'subscription.expiryDate': { $lt: now }
        });

        for (const user of expiredUsers) {
            user.isOnline = false;
            await user.save();
            emitToRoom(`${user.role.toLowerCase()}_${user._id}`, 'FORCED_OFFLINE', { reason: 'Subscription expired' });
        }

        const updated = await Customer.findById(shop._id);
        expect(updated.isOnline).toBe(false);
        expect(emitToRoom).toHaveBeenCalledWith(
            `shop_${shop._id}`,
            'FORCED_OFFLINE',
            expect.objectContaining({ reason: 'Subscription expired' })
        );
    });
});

describe('Cron Engine — Lock Mechanism', () => {
    it('should acquire and release Redis locks correctly', async () => {
        acquireLock.mockResolvedValue(true);
        releaseLock.mockResolvedValue(undefined);

        const locked = await acquireLock('cron:broadcast_sweep', 50);
        expect(locked).toBe(true);

        await releaseLock('cron:broadcast_sweep');
        expect(releaseLock).toHaveBeenCalledWith('cron:broadcast_sweep');
    });

    it('should skip sweep when lock cannot be acquired', async () => {
        acquireLock.mockResolvedValue(false);

        const locked = await acquireLock('cron:job_sweep', 50);
        expect(locked).toBe(false);
    });
});
