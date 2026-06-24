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
