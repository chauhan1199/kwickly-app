const cron = require('node-cron');
const Customer = require('../modules/customer/customer.model');
const Shop = require('../modules/shop/shop.model');
const { notifyUser } = require('../helpers/notifyUser.helper');
const { emitToRoom } = require('../helpers/socket.helper');
const { acquireLock, releaseLock } = require('../helpers/redis.helper');
const logger = require('../helpers/logger.helper');

/**
 * Run every day at Midnight (0 0 * * *)
 * Checks for upcoming expirations (3 days) and expired subscriptions.
 */
const startSubscriptionCron = () => {
    cron.schedule('0 0 * * *', async () => {
        logger.info('[CRON] Running daily subscription check...');
        const lockKey = 'cron:subscription_sweep';
        let holderId = null;

        try {
            holderId = await acquireLock(lockKey, 3600);
            if (!holderId) {
                logger.info('[CRON] Subscription check already acquired by another cluster node.');
                return;
            }
        } catch (e) {
            // Redis lock error fallback: proceed gracefully
        }

        const now = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(now.getDate() + 3);

        try {
            // 1. Find workers & shops whose subscription is expiring in exactly 3 days
            const startOf3Days = new Date(threeDaysFromNow);
            startOf3Days.setHours(0,0,0,0);
            const endOf3Days = new Date(threeDaysFromNow);
            endOf3Days.setHours(23,59,59,999);

            const expiringSoonUsers = await Customer.find({
                role: { $in: ['WORKER', 'SHOP'] },
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

            for (const user of expiringSoonUsers) {
                const serviceLabel = user.role === 'SHOP' ? 'orders' : 'jobs';
                notifyUser({
                    userId: user._id,
                    title: '⏳ Subscription Expiring Soon',
                    message: `Your subscription or trial expires in 3 days! Top up now to continue receiving ${serviceLabel}.`,
                    action: 'SUBSCRIPTION_EXPIRING',
                    entityType: 'SUBSCRIPTION',
                    targetRole: user.role
                });
            }

            // 2. Find workers & shops whose subscription just expired and mark them offline
            const expiredUsers = await Customer.find({
                role: { $in: ['WORKER', 'SHOP'] },
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

            for (const user of expiredUsers) {
                user.isOnline = false;
                await user.save();

                if (user.role === 'SHOP') {
                    await Shop.updateMany({ ownerId: user._id }, { isOnline: false });
                }

                const room = user.role === 'SHOP' ? `shop_${user._id}` : `worker_${user._id}`;
                const serviceLabel = user.role === 'SHOP' ? 'orders' : 'jobs';

                emitToRoom(room, 'FORCED_OFFLINE', {
                    reason: `Your subscription has expired. Please top-up to continue receiving ${serviceLabel}.`,
                    walletBalance: user.wallet?.balance || 0
                });

                notifyUser({
                    userId: user._id,
                    title: '❌ Subscription Expired',
                    message: `Your subscription has expired. You have been taken offline. Please top up to continue receiving ${serviceLabel}.`,
                    action: 'SUBSCRIPTION_EXPIRED',
                    entityType: 'SUBSCRIPTION',
                    targetRole: user.role
                });
            }

            logger.info(`[CRON] Subscription check complete. Notified ${expiringSoonUsers.length} expiring soon, deactivated ${expiredUsers.length} expired accounts.`);
        } catch (error) {
            logger.error('[CRON] Error checking subscriptions:', error.message);
        } finally {
            if (holderId) {
                try {
                    await releaseLock(lockKey, holderId);
                } catch (e) {}
            }
        }
    });
};

module.exports = { startSubscriptionCron };
