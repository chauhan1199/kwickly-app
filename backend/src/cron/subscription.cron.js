const cron = require('node-cron');
const Customer = require('../modules/customer/customer.model');
const { notifyUser } = require('../helpers/notifyUser.helper');
const { emitToRoom } = require('../helpers/socket.helper');

/**
 * Run every day at Midnight (0 0 * * *)
 * Checks for upcoming expirations (3 days) and expired subscriptions.
 */
const startSubscriptionCron = () => {
    cron.schedule('0 0 * * *', async () => {
        console.log('[CRON] Running daily subscription check...');
        const now = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(now.getDate() + 3);

        try {
            // 1. Find workers whose subscription is expiring in exactly 3 days
            const expiringSoonWorkers = await Customer.find({
                role: 'WORKER',
                $or: [
                    {
                        'subscription.expiryDate': {
                            $gte: new Date(threeDaysFromNow.setHours(0,0,0,0)),
                            $lte: new Date(threeDaysFromNow.setHours(23,59,59,999))
                        }
                    },
                    {
                        'subscription.isTrial': true,
                        'subscription.trialEndDate': {
                            $gte: new Date(threeDaysFromNow.setHours(0,0,0,0)),
                            $lte: new Date(threeDaysFromNow.setHours(23,59,59,999))
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

            console.log(`[CRON] Subscription check complete. Notified ${expiringSoonWorkers.length} expiring soon, deactivated ${expiredWorkers.length} expired workers.`);
        } catch (error) {
            console.error('[CRON] Error checking subscriptions:', error);
        }
    });
};

module.exports = { startSubscriptionCron };
