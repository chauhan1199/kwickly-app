const cron = require('node-cron');
const Job = require('../modules/job/job.model');
const ShopOrder = require('../modules/shoporder/shoporder.model');
const Customer = require('../modules/customer/customer.model');
const AppSettings = require('../modules/settings/settings.model');
const WalletTxn = require('../modules/wallet/wallet.model');
const logger = require('../helpers/logger.helper');
const { emitToRoom, emitToAll, getIO } = require('../helpers/socket.helper');
const { findEligibleWorkers } = require('../helpers/worker.helper');
const { getCache, setCache, delCache, acquireLock, releaseLock } = require('../helpers/redis.helper');
const { notifyUser } = require('../helpers/notifyUser.helper');
const Quote = require('../modules/quote/quote.model');
const mongoose = require('mongoose');
const { supportsTransactions } = require('../helpers/transaction.helper');

const startCronEngine = () => {
    logger.info('[Cron Engine] Master engine initialized. Scheduling progressive expansion and ghost sweeps...');

    // Run every minute
    cron.schedule('* * * * *', async () => {
        const holderId = await acquireLock('cron:broadcast_sweep', 120);
        if (!holderId) return; // Another node is handling this

        try {
            await sweepBroadcastingJobs();
        } catch (err) {
            logger.error('[Cron Engine] Broadcast sweep error: ' + err.message);
        } finally {
            await releaseLock('cron:broadcast_sweep', holderId);
        }
    });

    // Run every minute (ghost quotes)
    cron.schedule('* * * * *', async () => {
        const holderId = await acquireLock('cron:job_sweep', 50);
        if (!holderId) return; // Another node is handling this
        
        try {
            await sweepGhostQuotes();
        } catch (err) {
            logger.error('[Cron Engine] Job sweep error: ' + err.message);
        } finally {
            await releaseLock('cron:job_sweep', holderId);
        }
    });

    // Run every 5 minutes (shop orders)
    cron.schedule('*/5 * * * *', async () => {
        const holderId = await acquireLock('cron:order_sweep', 290);
        if (!holderId) return;
        
        try {
            await sweepGhostOrders();
        } catch (err) {
            logger.error('[Cron Engine] Order sweep error: ' + err.message);
        } finally {
            await releaseLock('cron:order_sweep', holderId);
        }
    });

    // Run every 10 minutes (worker timeouts)
    cron.schedule('*/10 * * * *', async () => {
        const holderId = await acquireLock('cron:worker_sweep', 590);
        if (!holderId) return;
        
        try {
            await sweepExpiredSubscriptions();
        } catch (err) {
            logger.error('[Cron Engine] Worker sweep error: ' + err.message);
        } finally {
            await releaseLock('cron:worker_sweep', holderId);
        }
    });

    // Run every 3 minutes (reconcile pending automated UPI payments)
    cron.schedule('*/3 * * * *', async () => {
        const holderId = await acquireLock('cron:upi_reconcile_sweep', 170);
        if (!holderId) return;

        try {
            await reconcilePendingUpiPayments();
        } catch (err) {
            logger.error('[Cron Engine] UPI reconcile sweep error: ' + err.message);
        } finally {
            await releaseLock('cron:upi_reconcile_sweep', holderId);
        }
    });
};

const sweepBroadcastingJobs = async () => {
    // Process jobs that have been in BROADCASTING and last attempt was >= 1 min ago
    const oneMinAgo = new Date(Date.now() - 60 * 1000);
    const broadcastingJobs = await Job.find({ 
        status: 'BROADCASTING', 
        'broadcast.lastAttemptAt': { $lt: oneMinAgo } 
    }).populate('customerId', 'name phone profileImage');

    if (broadcastingJobs.length === 0) return;

    // Load settings once for the sweep
    const SettingsService = require('../modules/settings/settings.service');
    const settings = await SettingsService.getAppSettings();
    const maxRadius = settings?.radius?.maxKm || 25;
    const minBalance = settings?.wallet?.minimumBalance || 100;

    for (const job of broadcastingJobs) {
        try {
        const nextRound = (job.broadcast.round || 1) + 1;

        if (nextRound > 3) {
            // Auto cancel after 3 rounds (75km radius search completed with 0 bids/workers)
            logger.info(`[Cron] Auto-cancelling job ${job._id} after 3 search rounds (No workers found)`);
            job.status = 'CANCELLED';
            job.cancelReason = 'No workers found nearby after searching up to 75 km.';
            job.broadcast.round = 3;
            await job.save();
            
            emitToRoom(`customer_${job.customerId?._id || job.customerId}`, 'JOB_STATUS_CHANGED', { 
                jobId: job._id, 
                status: 'CANCELLED', 
                reason: 'No workers found nearby after searching in 3 rounds up to 75 km.' 
            });

            notifyUser({
                userId: job.customerId?._id || job.customerId,
                title: 'Job Request Cancelled',
                message: `We searched in 3 rounds up to ${job.broadcast?.radiusKm || (3 * maxRadius)} km, but could not find available workers for your "${job.category}${job.subcategory ? ' - ' + job.subcategory : ''}" request. Please feel free to re-post anytime.`,
                action: 'JOB_CANCELLED',
                entityType: 'JOB',
                entityId: job._id,
                targetRole: 'CUSTOMER'
            });
            continue;
        }

        // Expand radius
        const newRadiusKm = nextRound * maxRadius;
        job.broadcast.round = nextRound;
        job.broadcast.radiusKm = newRadiusKm;
        job.broadcast.lastAttemptAt = new Date();
        await job.save();

        logger.info(`[Cron] Job ${job._id} expanding to round ${nextRound} (Radius: ${newRadiusKm}km)`);

        // Notify customer of expansion
        emitToRoom(`customer_${job.customerId?._id || job.customerId}`, 'JOB_RADIUS_EXPANDED', { 
            jobId: job._id, 
            radiusKm: newRadiusKm,
            round: nextRound
        });

        // Find workers
        const eligibleWorkerIds = await findEligibleWorkers(job, newRadiusKm, minBalance);

        if (eligibleWorkerIds.length > 0) {
            const customer = job.customerId;
            const alertPayload = {
                jobId: job._id,
                category: job.category,
                subcategory: job.subcategory,
                description: job.description,
                location: job.location,
                addressDetails: job.addressDetails,
                timeSlot: job.timeSlot,
                preferredDate: job.preferredDate,
                notifiedWorkers: eligibleWorkerIds.length,
                customer: {
                    _id: customer?._id,
                    name: customer?.name,
                    profileImage: customer?.profileImage
                }
            };

            eligibleWorkerIds.forEach(workerId => {
                emitToRoom(`worker_${workerId}`, 'NEW_JOB_ALERT', alertPayload);
            });
        }
        } catch (jobErr) {
            logger.error(`[Cron] Error processing job ${job._id}: ${jobErr.message}`);
        }
    }
};

const sweepGhostQuotes = async () => {
    // S4 FIX: Cancel QUOTES_RECEIVED jobs created > 2 hours ago that were never accepted
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const ghostJobs = await Job.find({ status: 'QUOTES_RECEIVED', createdAt: { $lt: twoHoursAgo } });
    
    for (const job of ghostJobs) {
        const isScheduled = job.preferredDate && new Date(job.preferredDate) > new Date();
        if (isScheduled) {
            // For scheduled jobs, do not auto-cancel until the preferred date passes
            continue;
        }

        logger.info(`[Cron] Cancelling ghost QUOTES_RECEIVED job ${job._id}`);
        job.status = 'CANCELLED';
        job.cancelReason = 'Auto-cancelled: quote acceptance window expired (2 hours)';
        await job.save();

        await delCache(`job:${job._id}:assigned_worker`);
        await delCache(`job:${job._id}:eligible_workers`);
        await delCache('admin_dashboard_stats');
        emitToAll('DASHBOARD_UPDATE', { type: 'JOB_CANCELLED', id: job._id });

        emitToRoom(`customer_${job.customerId}`, 'JOB_STATUS_CHANGED', {
            jobId: job._id,
            status: 'CANCELLED',
            reason: 'Quote acceptance timeout (2 hours)'
        });

        notifyUser({
            userId: job.customerId,
            title: 'Job Request Expired',
            message: `Your request for ${job.category || 'Service'} (#${String(job._id).slice(-6)}) expired because no quote was accepted within 2 hours.`,
            action: 'JOB_UPDATED',
            entityType: 'JOB',
            entityId: job._id,
            targetRole: 'CUSTOMER'
        });

        // B4 FIX: Notify all workers who submitted quotes and update quote status to EXPIRED
        try {
            const quotes = await Quote.find({ jobId: job._id, status: 'PENDING' });
            for (const q of quotes) {
                q.status = 'EXPIRED';
                await q.save();

                emitToRoom(`worker_${q.workerId}`, 'JOB_STATUS_CHANGED', {
                    jobId: job._id,
                    status: 'CANCELLED',
                    reason: 'Customer did not accept any quote within the 2-hour window'
                });

                notifyUser({
                    userId: q.workerId,
                    title: 'Quote Expired',
                    message: `Job #${String(job._id).slice(-6)} (${job.category || 'Service'}) was closed because no quote was accepted by the customer.`,
                    action: 'JOB_UPDATED',
                    entityType: 'JOB',
                    entityId: job._id,
                    targetRole: 'WORKER'
                });
            }
        } catch (quoteErr) {
            logger.error(`[Cron] Error notifying quoting workers for job ${job._id}: ${quoteErr.message}`);
        }
    }
};

const sweepGhostOrders = async () => {
    // Cancel NEW shop orders older than 30 mins
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const ghostOrders = await ShopOrder.find({ status: 'NEW', createdAt: { $lt: thirtyMinsAgo } });

    for (const order of ghostOrders) {
        logger.info(`[Cron] Cancelling ghost shop order ${order._id}`);
        order.status = 'CANCELLED';
        order.statusHistory.push({ status: 'CANCELLED', timestamp: new Date(), note: 'Auto-cancelled due to shop inactivity' });
        
        let session = null;
        let useTransaction = false;
        if (supportsTransactions()) {
            try {
                session = await mongoose.startSession();
                session.startTransaction();
                useTransaction = true;
            } catch (e) {
                session = null;
                useTransaction = false;
            }
        }

        try {
            // Restore reserved stock — the manual cancel paths do this, so the
            // automatic sweep must too, or stock leaks on every ghost order.
            const restorableItems = order.items.filter(item => item.productId);
            if (restorableItems.length > 0) {
                // Merge duplicate product lines so we do one write per product
                const restoreMap = new Map();
                for (const item of restorableItems) {
                    const key = String(item.productId);
                    restoreMap.set(key, (restoreMap.get(key) || 0) + item.qty);
                }
                const Product = require('../modules/product/product.model');
                await Product.bulkWrite(
                    [...restoreMap.entries()].map(([productId, qty]) => ({
                        updateOne: {
                            filter: { _id: productId },
                            update: { $inc: { stock: qty } }
                        }
                    })),
                    { session }
                );
            }

            // Refund if paid
            if (order.payment.status === 'PAID') {
                const refundedCustomer = await Customer.findByIdAndUpdate(order.customerId, {
                    $inc: { 'wallet.balance': order.total }
                }, { returnDocument: 'after', session });
                
                await WalletTxn.create([{
                    userId: order.customerId,
                    type: 'REFUND',
                    amount: order.total,
                    balance: refundedCustomer?.wallet?.balance || 0,
                    refId: String(order._id),
                    status: 'COMPLETED',
                    description: `Auto-refund for unconfirmed order #${order.orderNumber || String(order._id).slice(-6)}`
                }], { session });

                order.payment.status = 'REFUNDED';

                notifyUser({
                    userId: order.customerId,
                    title: 'Order Cancelled & Refunded',
                    message: `Shop could not confirm your order #${order.orderNumber || String(order._id).slice(-6)} in time. ₹${order.total} has been refunded to your Kwickly Wallet.`,
                    action: 'ORDER_CANCELLED',
                    entityType: 'ORDER',
                    entityId: order._id,
                    targetRole: 'CUSTOMER'
                });
            } else if (order.payment?.status === 'PENDING_VERIFICATION') {
                order.statusHistory.push({
                    status: 'CANCELLED',
                    timestamp: new Date(),
                    note: `Auto-cancelled due to shop inactivity (30m). UPI UTR (${order.payment?.utrNumber || 'none'}) pending Admin verification for wallet refund.`
                });

                notifyUser({
                    userId: order.customerId,
                    title: 'Order Cancelled — Refund Verification Pending',
                    message: `Shop could not confirm order #${order.orderNumber || String(order._id).slice(-6)} in time. If your UPI payment (UTR: ${order.payment?.utrNumber || 'N/A'}) was debited, our team will verify the credit and refund ₹${order.total} to your Kwickly Wallet.`,
                    action: 'ORDER_CANCELLED',
                    entityType: 'ORDER',
                    entityId: order._id,
                    targetRole: 'CUSTOMER'
                });
            }
            await order.save({ session });
            
            if (useTransaction) await session.commitTransaction();
            if (useTransaction) session.endSession();
        } catch (error) {
            if (useTransaction && session) await session.abortTransaction();
            if (session) session.endSession();
            logger.error(`[Cron] Error cancelling ghost order ${order._id}: ${error.message}`);
            continue; // Move to the next order instead of crashing the whole sweep
        }

        emitToRoom(`customer_${order.customerId}`, 'ORDER_STATUS', { orderId: order._id, status: 'CANCELLED', reason: 'Shop did not accept in time' });
        emitToRoom(`shop_${order.shopId}`, 'ORDER_STATUS', { orderId: order._id, status: 'CANCELLED' });
    }
};

const sweepExpiredSubscriptions = async () => {
    const now = new Date();
    
    // Find workers/shops online whose paid plan or free trial has expired
    const expiredUsers = await Customer.find({
        role: { $in: ['WORKER', 'SHOP'] },
        isOnline: true,
        $or: [
            { 'subscription.isTrial': true, 'subscription.trialEndDate': { $lt: now } },
            { 'subscription.isTrial': false, 'subscription.expiryDate': { $lt: now } }
        ]
    });

    for (const user of expiredUsers) {
        logger.info(`[Cron] Forcing user ${user._id} (${user.role}) offline due to subscription expiry`);
        user.isOnline = false;
        await user.save();

        const reason = user.subscription?.isTrial
            ? 'Free trial has expired. Please purchase a subscription to go online.'
            : 'Subscription has expired. Please renew to go online.';

        emitToRoom(`${user.role.toLowerCase()}_${user._id}`, 'FORCED_OFFLINE', { reason });
        emitToRoom(`user_${user._id}`, 'FORCED_OFFLINE', { reason });

        // B5 FIX: For SHOP users, also emit to the shop_{shopId} room
        if (user.role === 'SHOP') {
            try {
                const Shop = require('../modules/shop/shop.model');
                const shop = await Shop.findOne({ ownerId: user._id }).select('_id').lean();
                if (shop) {
                    emitToRoom(`shop_${shop._id}`, 'FORCED_OFFLINE', { reason });
                }
            } catch (shopErr) {
                logger.error(`[Cron] Error finding shop for user ${user._id}: ${shopErr.message}`);
            }
        }

        notifyUser({
            userId: user._id,
            title: 'Subscription Expired',
            message: reason,
            action: 'FORCED_OFFLINE',
            entityType: 'SUBSCRIPTION',
            entityId: user._id,
            targetRole: user.role
        });
    }
};

const reconcilePendingUpiPayments = async () => {
    const { isProviderConfigured, checkTransactionStatus } = require('../services/upiProvider.service');
    if (!isProviderConfigured()) return;

    const {
        handleWalletTopupWebhook,
        handleShopOrderWebhook,
        handleFailedPaymentWebhook
    } = require('../helpers/webhookHandlers.helper');

    // 1. Reconcile WalletTxn PENDING records (between 2 min and 24 hours old)
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const pendingTxns = await WalletTxn.find({
        status: 'PENDING',
        gatewayTransactionId: { $exists: true, $ne: null, $ne: '' },
        createdAt: { $lt: twoMinAgo, $gt: oneDayAgo }
    }).limit(20);

    for (const txn of pendingTxns) {
        try {
            const status = await checkTransactionStatus(txn.gatewayTransactionId);
            if (status === 'SUCCESS') {
                logger.info(`[Cron] Reconciled SUCCESS for WalletTxn ${txn._id}`);
                await handleWalletTopupWebhook({
                    metadata: {
                        internalId: txn._id.toString(),
                        purpose: txn.planId ? 'worker_subscription' : 'wallet_topup',
                        userId: txn.userId.toString(),
                        planId: txn.planId || null
                    },
                    amount: txn.amount,
                    status: 'SUCCESS',
                    event: 'payment.success',
                    transactionId: txn.gatewayTransactionId
                }, `cron_recon_${txn.gatewayTransactionId}`);
            } else if (status === 'FAILED') {
                logger.info(`[Cron] Reconciled FAILED for WalletTxn ${txn._id}`);
                await handleFailedPaymentWebhook({
                    metadata: {
                        internalId: txn._id.toString(),
                        purpose: txn.planId ? 'worker_subscription' : 'wallet_topup',
                        userId: txn.userId.toString()
                    },
                    status: 'FAILED',
                    transactionId: txn.gatewayTransactionId
                }, `cron_recon_${txn.gatewayTransactionId}`);
            }
        } catch (err) {
            logger.error(`[Cron] Reconcile error for WalletTxn ${txn._id}: ${err.message}`);
        }
    }

    // 2. Reconcile ShopOrder PENDING records
    const pendingOrders = await ShopOrder.find({
        'payment.status': 'PENDING',
        'payment.gatewayOrderId': { $exists: true, $ne: null, $ne: '' },
        createdAt: { $lt: twoMinAgo, $gt: oneDayAgo }
    }).limit(20);

    for (const order of pendingOrders) {
        try {
            const status = await checkTransactionStatus(order.payment.gatewayOrderId);
            if (status === 'SUCCESS') {
                logger.info(`[Cron] Reconciled SUCCESS for ShopOrder ${order._id}`);
                await handleShopOrderWebhook({
                    metadata: {
                        internalId: order._id.toString(),
                        purpose: 'shop_order',
                        userId: order.customerId.toString()
                    },
                    amount: order.total,
                    status: 'SUCCESS',
                    event: 'payment.success',
                    transactionId: order.payment.gatewayOrderId
                }, `cron_recon_${order.payment.gatewayOrderId}`);
            } else if (status === 'FAILED') {
                logger.info(`[Cron] Reconciled FAILED for ShopOrder ${order._id}`);
                await handleFailedPaymentWebhook({
                    metadata: {
                        internalId: order._id.toString(),
                        purpose: 'shop_order',
                        userId: order.customerId.toString()
                    },
                    status: 'FAILED',
                    transactionId: order.payment.gatewayOrderId
                }, `cron_recon_${order.payment.gatewayOrderId}`);
            }
        } catch (err) {
            logger.error(`[Cron] Reconcile error for ShopOrder ${order._id}: ${err.message}`);
        }
    }
};

module.exports = { startCronEngine, sweepBroadcastingJobs, reconcilePendingUpiPayments };
