const cron = require('node-cron');
const Job = require('../modules/job/job.model');
const ShopOrder = require('../modules/shoporder/shoporder.model');
const Customer = require('../modules/customer/customer.model');
const AppSettings = require('../modules/settings/settings.model');
const WalletTxn = require('../modules/wallet/wallet.model');
const logger = require('../helpers/logger.helper');
const { emitToRoom, getIO } = require('../helpers/socket.helper');
const { findEligibleWorkers } = require('../helpers/worker.helper');
const { getCache, setCache, acquireLock, releaseLock } = require('../helpers/redis.helper');
const { notifyUser } = require('../helpers/notifyUser.helper');
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
    const maxRadius = settings?.radius?.maxKm || 15;
    const minBalance = settings?.wallet?.minimumBalance || 100;

    for (const job of broadcastingJobs) {
        try {
        const nextRound = (job.broadcast.round || 1) + 1;

        if (nextRound > 3) {
            // Check if it's a scheduled job in the future
            const isScheduled = job.preferredDate && new Date(job.preferredDate) > new Date();

            if (isScheduled) {
                // Don't cancel scheduled jobs. Delay next broadcast by 30 minutes to avoid spam.
                logger.info(`[Cron] Scheduled Job ${job._id} passed 3 rounds. Delaying next broadcast.`);
                job.broadcast.lastAttemptAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins
                await job.save();
                continue;
            }

            // Auto cancel after 3 rounds
            logger.info(`[Cron] Cancelling job ${job._id} after 3 rounds (No workers found)`);
            job.status = 'CANCELLED';
            await job.save();
            
            emitToRoom(`customer_${job.customerId?._id || job.customerId}`, 'JOB_STATUS_CHANGED', { 
                jobId: job._id, 
                status: 'CANCELLED', 
                reason: 'No workers found nearby after expanding radius.' 
            });

            notifyUser({
                userId: job.customerId?._id || job.customerId,
                title: 'Job Cancelled',
                message: `We couldn't find any workers for your ${job.category} job. Please try again later.`,
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
    // Cancel QUOTES_RECEIVED jobs that are older than 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const ghostJobs = await Job.find({ status: 'QUOTES_RECEIVED', updatedAt: { $lt: twoHoursAgo } });
    
    for (const job of ghostJobs) {
        const isScheduled = job.preferredDate && new Date(job.preferredDate) > new Date();
        if (isScheduled) {
            // For scheduled jobs, do not auto-cancel until the preferred date passes
            continue;
        }

        logger.info(`[Cron] Cancelling ghost QUOTES_RECEIVED job ${job._id}`);
        job.status = 'CANCELLED';
        await job.save();
        emitToRoom(`customer_${job.customerId}`, 'JOB_STATUS_CHANGED', { jobId: job._id, status: 'CANCELLED', reason: 'Quote acceptance timeout' });
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
                    description: `Auto-refund for ignored order #${String(order._id).slice(-6)}`
                }], { session });
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
    
    // Find workers/shops online with expired subscriptions
    const expiredUsers = await Customer.find({
        role: { $in: ['WORKER', 'SHOP'] },
        isOnline: true,
        'subscription.isTrial': false,
        'subscription.expiryDate': { $lt: now }
    });

    for (const user of expiredUsers) {
        logger.info(`[Cron] Forcing user ${user._id} offline due to subscription expiry`);
        user.isOnline = false;
        await user.save();
        emitToRoom(`${user.role.toLowerCase()}_${user._id}`, 'FORCED_OFFLINE', { reason: 'Subscription expired' });
    }
};

module.exports = { startCronEngine, sweepBroadcastingJobs };
