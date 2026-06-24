const cron = require('node-cron');
const Job = require('../modules/job/job.model');
const ShopOrder = require('../modules/shoporder/shoporder.model');
const Customer = require('../modules/customer/customer.model');
const AppSettings = require('../modules/settings/settings.model');
const WalletTxn = require('../modules/wallet/wallet.model');
const logger = require('../helpers/logger.helper');
const { emitToRoom, getIO } = require('../helpers/socket.helper');

let isJobSweepRunning = false;
let isOrderSweepRunning = false;
let isWorkerSweepRunning = false;

const startCronEngine = () => {
    logger.info('[Cron Engine] Master engine initialized. Scheduling progressive expansion and ghost sweeps...');

    // Run every minute
    cron.schedule('* * * * *', async () => {
        if (isJobSweepRunning) return;
        isJobSweepRunning = true;
        try {
            await sweepBroadcastingJobs();
            await sweepGhostQuotes();
        } catch (err) {
            logger.error('[Cron Engine] Job sweep error: ' + err.message);
        } finally {
            isJobSweepRunning = false;
        }
    });

    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        if (isOrderSweepRunning) return;
        isOrderSweepRunning = true;
        try {
            await sweepGhostOrders();
        } catch (err) {
            logger.error('[Cron Engine] Order sweep error: ' + err.message);
        } finally {
            isOrderSweepRunning = false;
        }
    });

    // Run every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
        if (isWorkerSweepRunning) return;
        isWorkerSweepRunning = true;
        try {
            await sweepExpiredSubscriptions();
        } catch (err) {
            logger.error('[Cron Engine] Worker sweep error: ' + err.message);
        } finally {
            isWorkerSweepRunning = false;
        }
    });
};

const sweepBroadcastingJobs = async () => {
    const settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
    if (!settings?.radius?.rounds || settings.radius.rounds.length === 0) return;

    const rounds = settings.radius.rounds;
    const now = new Date();

    const jobs = await Job.find({ status: 'BROADCASTING' });

    for (const job of jobs) {
        const currentRoundIndex = job.broadcast?.round || 0;
        const currentRoundConfig = rounds[currentRoundIndex];
        
        if (!currentRoundConfig) continue;

        const lastAttempt = job.broadcast?.lastAttemptAt || job.createdAt;
        const minutesWaiting = (now.getTime() - new Date(lastAttempt).getTime()) / 60000;

        if (minutesWaiting >= (currentRoundConfig.waitMinutes || 5)) {
            // Time to expand or cancel
            const nextRoundIndex = currentRoundIndex + 1;
            
            if (nextRoundIndex < rounds.length) {
                const nextRoundConfig = rounds[nextRoundIndex];
                
                logger.info(`[Cron] Expanding job ${job._id} to round ${nextRoundIndex} (${nextRoundConfig.maxKm}km)`);
                
                // Update Job state
                job.broadcast.round = nextRoundIndex;
                job.broadcast.lastAttemptAt = now;
                job.broadcast.radiusKm = nextRoundConfig.maxKm;
                await job.save();

                // Find workers for new radius
                const globalRadiusRadians = nextRoundConfig.maxKm / 6371;
                const minBalance = settings.wallet?.minimumBalance || 100;
                
                const workerQuery = {
                    role: 'WORKER',
                    isVerified: true,
                    'kyc.status': 'APPROVED',
                    isOnline: true,
                    $or: [
                        { 'subscription.isTrial': true },
                        { 'subscription.expiryDate': { $gt: now } },
                        { createdAt: { $gt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000) } }
                    ],
                    'wallet.balance': { $gte: minBalance },
                    activeLocation: {
                        $geoWithin: { $centerSphere: [job.location.coordinates, globalRadiusRadians] }
                    }
                };

                if (job.addressDetails?.city) {
                    workerQuery.city = { $regex: new RegExp('^' + job.addressDetails.city + '$', 'i') };
                }

                const candidateWorkers = await Customer.find(workerQuery).select('_id services serviceRadius activeLocation');
                
                const targetJobCategory = (job.category || '').trim().toLowerCase();
                const eligibleWorkerIds = candidateWorkers.filter(worker => {
                    const hasMatchingCategory = (worker.services || []).some(svc => {
                        if (!svc.isActive) return false;
                        const catName = (svc.categoryName || svc.category?.name || '').toString().trim().toLowerCase();
                        return catName === targetJobCategory;
                    });
                    if (!hasMatchingCategory) return false;

                    const workerCoords = worker.activeLocation?.coordinates;
                    if (!workerCoords || workerCoords.length !== 2) return false;
                    const [wLng, wLat] = workerCoords;
                    const workerRadiusKm = worker.serviceRadius || nextRoundConfig.maxKm;
                    const [jobLng, jobLat] = job.location.coordinates;
                    
                    const R = 6371;
                    const dLat = ((jobLat - wLat) * Math.PI) / 180;
                    const dLng = ((jobLng - wLng) * Math.PI) / 180;
                    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((wLat * Math.PI) / 180) * Math.cos((jobLat * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
                    const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

                    return distanceKm <= workerRadiusKm;
                }).map(w => w._id.toString());

                if (eligibleWorkerIds.length > 0) {
                    const io = getIO();
                    if (io) {
                        eligibleWorkerIds.forEach(id => {
                            io.to(`worker_${id}`).emit('NEW_JOB_ALERT', {
                                jobId: job._id,
                                category: job.category,
                                subcategory: job.subcategory,
                                distanceKm: nextRoundConfig.maxKm,
                                isExpansion: true
                            });
                        });
                    }
                    logger.info(`[Cron] Emitted NEW_JOB_ALERT for ${job._id} to ${eligibleWorkerIds.length} expanded workers`);
                }
            } else {
                // Exhausted all rounds. Auto-cancel to prevent infinite hanging.
                logger.info(`[Cron] Job ${job._id} exhausted all broadcast rounds. Auto-cancelling.`);
                job.status = 'CANCELLED';
                await job.save();
                emitToRoom(`customer_${job.customerId}`, 'JOB_STATUS_CHANGED', { jobId: job._id, status: 'CANCELLED', reason: 'No workers found' });
            }
        }
    }
};

const sweepGhostQuotes = async () => {
    // Cancel QUOTES_RECEIVED jobs that are older than 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const ghostJobs = await Job.find({ status: 'QUOTES_RECEIVED', updatedAt: { $lt: twoHoursAgo } });
    
    for (const job of ghostJobs) {
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
        
        const mongoose = require('mongoose');
        const isSingle = mongoose.connection.client.topology.s.description.type === 'Single';
        const session = isSingle ? null : await mongoose.startSession();
        if (session) session.startTransaction();

        try {
            // Refund if paid
            if (order.payment.status === 'PAID') {
                const refundedCustomer = await Customer.findByIdAndUpdate(order.customerId, {
                    $inc: { 'wallet.balance': order.total }
                }, { new: true, session });
                
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
            
            if (session) await session.commitTransaction();
            if (session) session.endSession();
        } catch (error) {
            if (session) await session.abortTransaction();
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

module.exports = { startCronEngine };
