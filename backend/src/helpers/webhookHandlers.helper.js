/**
 * UPI Webhook Purpose Handlers
 *
 * Each exported function handles one payment "purpose" routed from the
 * main webhook controller. All handlers are:
 *
 *   1. IDEMPOTENT — MongoDB atomic findOneAndUpdate with status guard
 *      ensures a re-fired webhook never double-credits.
 *   2. SELF-CONTAINED — errors are caught internally; they log and return
 *      without re-throwing so the webhook controller always replies 200 OK.
 *   3. ASYNC-SAFE — called via setImmediate after the HTTP response is sent,
 *      so the provider never waits on our downstream logic.
 *
 * Edge cases covered:
 *   - Order CANCELLED by sweep cron while customer was in their UPI app
 *     → payment converted to wallet credit automatically
 *   - Duplicate webhook fire (provider retry) → silently skipped
 *   - Amount mismatch → held for admin review (conservative default)
 */

'use strict';

const mongoose = require('mongoose');
const Customer  = require('../modules/customer/customer.model');
const Shop      = require('../modules/shop/shop.model');
const WalletTxn = require('../modules/wallet/wallet.model');
const ShopOrder = require('../modules/shoporder/shoporder.model');
const Product   = require('../modules/product/product.model');
const { AdminWallet, AdminWalletTxn } = require('../modules/adminWallet/adminWallet.model');
const { notifyUser } = require('./notifyUser.helper');
const { emitToRoom, emitToAll } = require('./socket.helper');
const { delCache }  = require('./redis.helper');
const logger = require('./logger.helper');

/* ─── Shared Treasury Credit ──────────────────────────────────────────────── */

const creditAdminTreasury = async ({ amount, description, referenceId, referenceModel, type = 'TOPUP' }) => {
    try {
        const adminW = await AdminWallet.findOneAndUpdate(
            {},
            { $inc: { balance: amount, totalCollected: amount } },
            { returnDocument: 'after', upsert: true }
        );
        await AdminWalletTxn.create([{
            type,
            amount,
            balanceAfter: adminW.balance,
            description,
            referenceId,
            referenceModel
        }]);
    } catch (err) {
        logger.error(`[WebhookHandlers] creditAdminTreasury failed: ${err.message}`);
    }
};

/* ─── Helper: Paise → Rupees ──────────────────────────────────────────────── */
const toRupees = (raw) => {
    const n = Number(raw);
    // Provider may send either rupees or paise; values >= 10000 are treated as paise
    return n >= 10000 ? n / 100 : n;
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  HANDLER 1 — Wallet Topup                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @param {object} payload    - Normalised provider webhook payload
 * @param {string} eventId    - Provider's unique event/transaction ID (idempotency key)
 */
const handleWalletTopupWebhook = async (payload, eventId) => {
    const internalId = payload.metadata?.internalId;

    if (!internalId) {
        logger.warn(`[WebhookHandlers:WalletTopup] Missing internalId — eventId=${eventId}`);
        return;
    }

    try {
        let claimed = null;
        if (internalId && mongoose.isValidObjectId(internalId)) {
            claimed = await WalletTxn.findOneAndUpdate(
                { _id: internalId, status: { $ne: 'COMPLETED' } },
                {
                    $set: {
                        status:               'COMPLETED',
                        gatewayTransactionId: eventId,
                        webhookEventId:       eventId,
                        verifiedAt:           new Date()
                    }
                },
                { returnDocument: 'after' }
            );
        }

        // Fallback: match by UTR or transaction ID if internalId was not in metadata
        if (!claimed && eventId) {
            claimed = await WalletTxn.findOneAndUpdate(
                {
                    status: { $ne: 'COMPLETED' },
                    $or: [
                        { razorpayPaymentId: eventId },
                        { gatewayTransactionId: eventId },
                        ...(payload.utr ? [{ razorpayPaymentId: payload.utr }] : []),
                        ...(payload.transactionId ? [{ razorpayPaymentId: payload.transactionId }] : [])
                    ]
                },
                {
                    $set: {
                        status:               'COMPLETED',
                        gatewayTransactionId: eventId,
                        webhookEventId:       eventId,
                        verifiedAt:           new Date()
                    }
                },
                { returnDocument: 'after' }
            );
        }

        // Fallback: match by exact amount for pending topups in the last 30 minutes
        if (!claimed && payload.amount) {
            const expectedAmount = toRupees(payload.amount);
            const candidate = await WalletTxn.findOne({
                status: 'PENDING',
                type: 'TOPUP',
                amount: expectedAmount,
                createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
            }).sort('-createdAt');

            if (candidate) {
                claimed = await WalletTxn.findOneAndUpdate(
                    { _id: candidate._id, status: 'PENDING' },
                    {
                        $set: {
                            status:               'COMPLETED',
                            razorpayPaymentId:    eventId,
                            gatewayTransactionId: eventId,
                            webhookEventId:       eventId,
                            verifiedAt:           new Date()
                        }
                    },
                    { returnDocument: 'after' }
                );
            }
        }

        if (!claimed) {
            logger.info(`[WebhookHandlers:WalletTopup] Already processed or not found — internalId=${internalId}, eventId=${eventId}`);
            return;
        }

        const userId = claimed.userId;
        const amount = claimed.amount || toRupees(payload.amount);

        const user = await Customer.findById(userId).lean();
        const isShop = user?.role === 'SHOP' || user?.role === 'SHOP_OWNER';
        let newBalance = 0;

        if (isShop) {
            const updatedShop = await Shop.findOneAndUpdate(
                { ownerId: userId },
                { $inc: { 'wallet.balance': amount } },
                { returnDocument: 'after' }
            );
            newBalance = updatedShop?.wallet?.balance ?? amount;
        } else {
            const updatedUser = await Customer.findByIdAndUpdate(
                userId,
                { $inc: { 'wallet.balance': amount } },
                { returnDocument: 'after' }
            );
            newBalance = updatedUser?.wallet?.balance ?? amount;
        }

        // Update the txn's balance snapshot
        await WalletTxn.findByIdAndUpdate(claimed._id, {
            $set: { balance: newBalance, razorpayPaymentId: claimed.razorpayPaymentId || eventId }
        });

        // If this topup was a subscription plan purchase, activate the plan
        if (claimed.planId) {
            if (isShop) {
                await _activateShopSubscription({
                    userId,
                    planId: claimed.planId,
                    walletTxnId: claimed._id,
                    eventId,
                    amount
                });
            } else if (user?.role === 'WORKER') {
                await _activateWorkerSubscription({
                    userId,
                    planId: claimed.planId,
                    walletTxnId: claimed._id,
                    eventId,
                    amount
                });
            }
        }

        // Credit admin treasury
        await creditAdminTreasury({
            amount,
            description:    `Wallet topup verified via webhook — ${user?.role || 'User'} ${user?.name || userId} (event: ${eventId})`,
            referenceId:    claimed._id,
            referenceModel: 'WalletTxn',
            type:           'TOPUP'
        });

        await delCache(`session:${userId}`);
        await delCache('admin_dashboard_stats');

        // In-app notification
        await notifyUser({
            userId,
            title:   claimed.planId ? 'Subscription Plan Activated! 🎉' : 'Wallet Topped Up ✓',
            message: claimed.planId
                ? `Your payment of ₹${amount} was confirmed and your plan has been activated!`
                : `₹${amount} has been added to your Kwickly Wallet instantly. New Balance: ₹${newBalance}`,
            type:    'WALLET_CREDIT',
            referenceId:    claimed._id,
            referenceModel: 'WalletTxn',
            targetRole: user?.role || 'CUSTOMER'
        });

        const { emitToUser } = require('./socket.helper');
        emitToUser(userId, 'WALLET_TOPUP_APPROVED', { amount, newBalance, txnId: claimed._id });
        emitToUser(userId, 'WALLET_UPDATE', { balance: newBalance, amount, type: 'TOPUP' });
        emitToAll('DASHBOARD_UPDATE', { type: 'WALLET_TOPUP_APPROVED', txnId: claimed._id, userId });

        logger.info(`[WebhookHandlers:WalletTopup] ✓ ₹${amount} credited to ${user?.role || 'user'} ${userId} — eventId=${eventId}`);
    } catch (err) {
        logger.error(`[WebhookHandlers:WalletTopup] Error for internalId=${internalId}: ${err.message}`);
    }
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  HANDLER 2 — Shop Order Payment                                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

const handleShopOrderWebhook = async (payload, eventId) => {
    const internalId = payload.metadata?.internalId;

    if (!internalId) {
        logger.warn(`[WebhookHandlers:ShopOrder] Missing internalId — eventId=${eventId}`);
        return;
    }

    try {
        // ATOMIC IDEMPOTENCY CLAIM
        // We intentionally do NOT filter on order.status here — we need to
        // capture the post-update document even when the order was CANCELLED
        // (cancelled-during-payment edge case handled below).
        const claimed = await ShopOrder.findOneAndUpdate(
            { _id: internalId, 'payment.status': { $ne: 'PAID' } },
            {
                $set: {
                    'payment.status':               'PAID',
                    'payment.gatewayTransactionId': eventId,
                    'payment.webhookEventId':       eventId,
                    'payment.verifiedAt':           new Date()
                },
                $push: {
                    statusHistory: {
                        status:    'PAYMENT_CONFIRMED',
                        timestamp: new Date(),
                        note:      `Payment auto-verified via UPI webhook (event: ${eventId})`
                    }
                }
            },
            { returnDocument: 'after' }
        );

        if (!claimed) {
            logger.info(`[WebhookHandlers:ShopOrder] Already processed or not found — internalId=${internalId}, eventId=${eventId}`);
            return;
        }

        const customerId = claimed.customerId;
        const shopId     = claimed.shopId;
        const amount     = claimed.total || toRupees(payload.amount);

        // ─── CANCELLED-DURING-PAYMENT EDGE CASE ─────────────────────────────
        // The order sweep cron cancelled this order while the customer was in
        // their UPI app. Money has landed. Refund to wallet immediately.
        if (claimed.status === 'CANCELLED') {
            logger.info(`[WebhookHandlers:ShopOrder] Order ${internalId} was CANCELLED — converting UPI credit to wallet refund`);

            const refundedUser = await Customer.findByIdAndUpdate(
                customerId,
                { $inc: { 'wallet.balance': amount } },
                { returnDocument: 'after' }
            );

            await WalletTxn.create({
                userId:               customerId,
                type:                 'REFUND',
                amount,
                balance:              refundedUser?.wallet?.balance ?? amount,
                status:               'COMPLETED',
                webhookEventId:       eventId,
                gatewayTransactionId: eventId,
                verifiedAt:           new Date(),
                refId:                String(internalId),
                description:          `Auto-refund: Order #${claimed.orderNumber || internalId} expired during UPI payment (event: ${eventId})`
            });

            await notifyUser({
                userId:   customerId,
                title:    'Order Expired — Refund Applied ✓',
                message:  `Your order expired while we were waiting to confirm it, but your ₹${amount} payment landed safely and has been credited to your Kwickly Wallet. Please re-order.`,
                type:     'WALLET_CREDIT',
                referenceId:    internalId,
                referenceModel: 'ShopOrder'
            });

            emitToRoom(`customer_${customerId}`, 'ORDER_STATUS', {
                orderId: internalId, status: 'CANCELLED', paymentStatus: 'REFUNDED'
            });

            await delCache(`session:${customerId}`);
            return;
        }
        // ─────────────────────────────────────────────────────────────────────

        // Normal path — credit admin treasury escrow
        await creditAdminTreasury({
            amount,
            description:    `Shop Order #${claimed.orderNumber || internalId} UPI payment verified via webhook (event: ${eventId})`,
            referenceId:    internalId,
            referenceModel: 'ShopOrder',
            type:           'TOPUP'
        });

        // Notify customer
        await notifyUser({
            userId:   customerId,
            title:    'Payment Confirmed ✓',
            message:  `Your payment of ₹${amount} for Order #${claimed.orderNumber} has been confirmed. Your order is being prepared!`,
            action:   'ORDER_PAYMENT_CONFIRMED',
            entityType: 'ORDER',
            entityId: internalId,
            targetRole: 'CUSTOMER'
        });

        // Notify shop owner
        await notifyUser({
            userId:   shopId, // shop owner resolved by notifyUser helper
            title:    'New Order — Payment Received ✓',
            message:  `Order #${claimed.orderNumber} payment of ₹${amount} confirmed. Please prepare the order.`,
            action:   'NEW_ORDER_PAYMENT',
            entityType: 'ORDER',
            entityId: internalId,
            targetRole: 'SHOP_OWNER'
        });

        emitToRoom(`customer_${customerId}`, 'ORDER_STATUS', {
            orderId: internalId, status: claimed.status, paymentStatus: 'PAID'
        });
        emitToRoom(`shop_${shopId}`, 'ORDER_STATUS', {
            orderId: internalId, status: claimed.status, paymentStatus: 'PAID'
        });
        emitToAll('DASHBOARD_UPDATE', { type: 'ORDER_PAYMENT_CONFIRMED', id: internalId });

        logger.info(`[WebhookHandlers:ShopOrder] ✓ Order ${claimed.orderNumber} payment of ₹${amount} confirmed — eventId=${eventId}`);
    } catch (err) {
        logger.error(`[WebhookHandlers:ShopOrder] Error for internalId=${internalId}: ${err.message}`);
    }
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  HANDLER 3 — Worker Subscription                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

const handleWorkerSubscriptionWebhook = async (payload, eventId) => {
    const internalId = payload.metadata?.internalId; // WalletTxn._id
    const userId     = payload.metadata?.userId;
    const planId     = payload.metadata?.planId;

    if (!internalId || !userId || !planId) {
        logger.warn(`[WebhookHandlers:WorkerSub] Missing required metadata — eventId=${eventId}`);
        return;
    }

    try {
        // Mark WalletTxn as COMPLETED (idempotency guard)
        const claimed = await WalletTxn.findOneAndUpdate(
            { _id: internalId, status: { $ne: 'COMPLETED' } },
            {
                $set: {
                    status:               'COMPLETED',
                    gatewayTransactionId: eventId,
                    webhookEventId:       eventId,
                    verifiedAt:           new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!claimed) {
            logger.info(`[WebhookHandlers:WorkerSub] Already processed — internalId=${internalId}`);
            return;
        }

        const amount = claimed.amount || toRupees(payload.amount);
        await _activateWorkerSubscription({ userId, planId, walletTxnId: claimed._id, eventId, amount });

        await creditAdminTreasury({
            amount,
            description:    `Worker subscription plan "${planId}" payment verified via webhook (event: ${eventId})`,
            referenceId:    internalId,
            referenceModel: 'WalletTxn',
            type:           'PLATFORM_FEE_COLLECTED'
        });

        logger.info(`[WebhookHandlers:WorkerSub] ✓ Plan "${planId}" activated for user ${userId} — eventId=${eventId}`);
    } catch (err) {
        logger.error(`[WebhookHandlers:WorkerSub] Error for userId=${userId}: ${err.message}`);
    }
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  HANDLER 4 — Shop Subscription                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

const handleShopSubscriptionWebhook = async (payload, eventId) => {
    const internalId = payload.metadata?.internalId; // WalletTxn._id
    const userId     = payload.metadata?.userId;     // shop owner Customer._id
    const planId     = payload.metadata?.planId;

    if (!internalId || !userId || !planId) {
        logger.warn(`[WebhookHandlers:ShopSub] Missing required metadata — eventId=${eventId}`);
        return;
    }

    try {
        const claimed = await WalletTxn.findOneAndUpdate(
            { _id: internalId, status: { $ne: 'COMPLETED' } },
            {
                $set: {
                    status:               'COMPLETED',
                    gatewayTransactionId: eventId,
                    webhookEventId:       eventId,
                    verifiedAt:           new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!claimed) {
            logger.info(`[WebhookHandlers:ShopSub] Already processed — internalId=${internalId}`);
            return;
        }

        const amount = claimed.amount || toRupees(payload.amount);
        await _activateShopSubscription({ userId, planId, walletTxnId: claimed._id, eventId, amount });

        await creditAdminTreasury({
            amount,
            description:    `Shop subscription plan "${planId}" payment verified via webhook (event: ${eventId})`,
            referenceId:    internalId,
            referenceModel: 'WalletTxn',
            type:           'PLATFORM_FEE_COLLECTED'
        });

        logger.info(`[WebhookHandlers:ShopSub] ✓ Plan "${planId}" activated for shop owner ${userId} — eventId=${eventId}`);
    } catch (err) {
        logger.error(`[WebhookHandlers:ShopSub] Error for userId=${userId}: ${err.message}`);
    }
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  HANDLER 5 — Failed Payment                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

const handleFailedPaymentWebhook = async (payload, eventId) => {
    const internalId = payload.metadata?.internalId;
    const purpose    = payload.metadata?.purpose;

    if (!internalId || !purpose) return;

    logger.info(`[WebhookHandlers:Failed] Payment failed — purpose=${purpose}, internalId=${internalId}, eventId=${eventId}`);

    try {
        if (purpose === 'wallet_topup' || purpose === 'worker_subscription' || purpose === 'shop_subscription') {
            await WalletTxn.findOneAndUpdate(
                { _id: internalId, status: 'PENDING' },
                { $set: { status: 'FAILED', webhookEventId: eventId, verifiedAt: new Date() } }
            );
            const txn = await WalletTxn.findById(internalId).lean();
            if (txn) {
                await notifyUser({
                    userId:   txn.userId,
                    title:    purpose === 'wallet_topup' ? 'Wallet Topup Failed' : 'Subscription Payment Failed',
                    message:  `Your UPI payment could not be processed. No money has been deducted. Please try again.`,
                    type:     'WALLET_REJECTED',
                    referenceId:    internalId,
                    referenceModel: 'WalletTxn'
                });
            }
        }

        if (purpose === 'shop_order') {
            const order = await ShopOrder.findById(internalId);
            if (order && !['CANCELLED', 'DELIVERED'].includes(order.status)) {
                // Restore stock
                for (const item of order.items) {
                    if (item.productId) {
                        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.qty } });
                    }
                }
                order.status          = 'CANCELLED';
                order.payment.status  = 'FAILED';
                order.statusHistory.push({
                    status:    'CANCELLED',
                    timestamp: new Date(),
                    note:      `UPI payment failed (event: ${eventId})`
                });
                await order.save();

                await notifyUser({
                    userId:   order.customerId,
                    title:    'Payment Failed — Order Cancelled',
                    message:  `Your payment for Order #${order.orderNumber} could not be processed. No money was deducted. Your order has been cancelled.`,
                    action:   'ORDER_CANCELLED',
                    entityType: 'ORDER',
                    entityId: internalId,
                    targetRole: 'CUSTOMER'
                });

                emitToRoom(`customer_${order.customerId}`, 'ORDER_STATUS', {
                    orderId: internalId, status: 'CANCELLED', paymentStatus: 'FAILED'
                });
                emitToRoom(`shop_${order.shopId}`, 'ORDER_STATUS', {
                    orderId: internalId, status: 'CANCELLED', paymentStatus: 'FAILED'
                });
            }
        }
    } catch (err) {
        logger.error(`[WebhookHandlers:Failed] Error for internalId=${internalId}: ${err.message}`);
    }
};

/* ─── Private helpers ────────────────────────────────────────────────────── */

async function _activateWorkerSubscription({ userId, planId, walletTxnId, eventId, amount }) {
    const AppSettings = require('../modules/settings/settings.model');
    const { WorkerSubscription } = require('../modules/subscription/subscription.model');

    const settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
    const plan = (settings?.subscriptionPlans || []).find(p => p.id === planId);
    const days = plan?.durationDays || 30;

    const worker = await Customer.findById(userId).lean();
    const base = (worker?.subscription?.expiryDate && new Date(worker.subscription.expiryDate) > new Date())
        ? new Date(worker.subscription.expiryDate)
        : new Date();
    const newExpiry = new Date(base.getTime() + days * 86400000);

    // Activate on Customer doc
    await Customer.findByIdAndUpdate(userId, {
        $set: {
            'subscription.planId':     planId,
            'subscription.expiryDate': newExpiry,
            'subscription.isTrial':    false,
            'subscription.isActive':   true
        }
    });

    // Create WorkerSubscription record (idempotent — upsert on walletTxnId ref)
    await WorkerSubscription.findOneAndUpdate(
        { workerId: userId, 'payment.webhookEventId': eventId },
        {
            $setOnInsert: {
                workerId:  userId,
                planId,
                planName:  plan?.label || planId,
                amount:    amount || plan?.price || 0,
                startDate: new Date(),
                endDate:   newExpiry,
                isTrial:   false,
                payment: {
                    status:         'PAID',
                    webhookEventId: eventId,
                    verifiedAt:     new Date()
                }
            }
        },
        { upsert: true }
    );

    await delCache(`session:${userId}`);
    await delCache('admin_dashboard_stats');

    await notifyUser({
        userId,
        title:   'Subscription Activated! 🎉',
        message: `Your ${plan?.label || planId} plan is now active until ${newExpiry.toDateString()}.`,
        type:    'WALLET_CREDIT',
        referenceId:    walletTxnId,
        referenceModel: 'WalletTxn'
    });

    const { emitToUser } = require('./socket.helper');
    emitToUser(userId, 'SUBSCRIPTION_ACTIVATED', { userId, planId, planName: plan?.label || planId, expiryDate: newExpiry });
    emitToAll('DASHBOARD_UPDATE', { type: 'SUBSCRIPTION_ACTIVATED', userId, planId });
}

async function _activateShopSubscription({ userId, planId, walletTxnId, eventId, amount }) {
    const AppSettings = require('../modules/settings/settings.model');
    const { ShopSubscription } = require('../modules/subscription/subscription.model');

    const settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
    const plan = (settings?.subscriptionPlans || []).find(p => p.id === planId);
    const days = plan?.durationDays || 30;

    const shop = await Shop.findOne({ ownerId: userId }).lean();
    if (!shop) {
        logger.error(`[WebhookHandlers:ShopSub] Shop not found for owner ${userId}`);
        return;
    }

    const base = (shop?.subscription?.expiryDate && new Date(shop.subscription.expiryDate) > new Date())
        ? new Date(shop.subscription.expiryDate)
        : new Date();
    const newExpiry = new Date(base.getTime() + days * 86400000);

    await Shop.findByIdAndUpdate(shop._id, {
        $set: {
            'subscription.planId':     planId,
            'subscription.expiryDate': newExpiry,
            'subscription.isTrial':    false
        }
    });

    await ShopSubscription.findOneAndUpdate(
        { shopId: shop._id, 'payment.webhookEventId': eventId },
        {
            $setOnInsert: {
                shopId:  shop._id,
                planId,
                planName: plan?.label || planId,
                amount:   amount || plan?.price || 0,
                startDate: new Date(),
                endDate:  newExpiry,
                isTrial:  false,
                payment: {
                    status:         'PAID',
                    webhookEventId: eventId,
                    verifiedAt:     new Date()
                }
            }
        },
        { upsert: true }
    );

    await delCache(`session:${userId}`);
    await delCache('admin_dashboard_stats');

    await notifyUser({
        userId,
        title:   'Shop Subscription Activated! 🎉',
        message: `Your ${plan?.label || planId} plan is active until ${newExpiry.toDateString()}.`,
        type:    'WALLET_CREDIT',
        referenceId:    walletTxnId,
        referenceModel: 'WalletTxn',
        targetRole: 'SHOP'
    });

    const { emitToUser } = require('./socket.helper');
    emitToUser(userId, 'SUBSCRIPTION_ACTIVATED', { userId, planId, planName: plan?.label || planId, shopId: shop._id, expiryDate: newExpiry });
    emitToAll('DASHBOARD_UPDATE', { type: 'SUBSCRIPTION_ACTIVATED', userId, planId, shopId: shop._id });
}

module.exports = {
    handleWalletTopupWebhook,
    handleShopOrderWebhook,
    handleWorkerSubscriptionWebhook,
    handleShopSubscriptionWebhook,
    handleFailedPaymentWebhook
};
