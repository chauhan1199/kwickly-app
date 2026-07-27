const cron = require('node-cron');
const Customer = require('../modules/customer/customer.model');
const { notifyUser } = require('../helpers/notifyUser.helper');
const { emitToRoom } = require('../helpers/socket.helper');
const logger = require('../helpers/logger.helper');

/**
 * Run every day at Midnight (0 0 * * *)
 * Checks for upcoming expirations (3 days) and expired subscriptions.
 */
const startSubscriptionCron = () => {
    cron.schedule('0 0 * * *', async () => {
        logger.info('[CRON] Running daily subscription check...');
        const now = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(now.getDate() + 3);

        try {
            // 1. Find workers whose subscription is expiring in exactly 3 days
            const startOf3Days = new Date(threeDaysFromNow);
            startOf3Days.setHours(0,0,0,0);
            const endOf3Days = new Date(threeDaysFromNow);
            endOf3Days.setHours(23,59,59,999);

            const expiringSoonWorkers = await Customer.find({
                role: 'WORKER',
                $or: [
                    {
                        'subscription.expiryDate': {
                            $gte: startOf3Days,
                            $lte: endOf3Days
                        }
                    },
                    {
                        'subscription.isTrial': true,
                        'subscription.trialEndDate': {
                            $gte: startOf3Days,
                            $lte: endOf3Days
                        }
                    }
                ]
            });

            for (const worker of expiringSoonWorkers) {
                notifyUser({
                    userId: worker._id,
                    title: '⏳ Subscription Expiring Soon',
                    message: 'Your subscription or trial expires in 3 days! Top up now to continue receiving jobs.',
                    action: 'SUBSCRIPTION_EXPIRING',
                    entityType: 'SUBSCRIPTION',
                    targetRole: 'WORKER'
                });
            }

            // 2. Find workers whose subscription just expired today and mark them offline
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

            for (const worker of expiredWorkers) {
                worker.isOnline = false;
                await worker.save();
                
                emitToRoom(`worker_${worker._id}`, 'FORCED_OFFLINE', {
                    reason: 'Your subscription has expired. Please top-up to continue receiving jobs.',
                    walletBalance: worker.wallet?.balance || 0
                });

                notifyUser({
                    userId: worker._id,
                    title: '❌ Subscription Expired',
                    message: 'Your subscription has expired. You have been taken offline. Please top up to continue.',
                    action: 'SUBSCRIPTION_EXPIRED',
                    entityType: 'SUBSCRIPTION',
                    targetRole: 'WORKER'
                });
            }

            logger.info(`[CRON] Subscription check complete. Notified ${expiringSoonWorkers.length} expiring soon, deactivated ${expiredWorkers.length} expired workers.`);
        } catch (error) {
            logger.error('[CRON] Error checking subscriptions:', error.message);
        }
    });
};

module.exports = { startSubscriptionCron };
