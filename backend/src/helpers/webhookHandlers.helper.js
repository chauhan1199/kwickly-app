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
const Payment   = require('../modules/payment/payment.model');
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
const toRupees = (raw, providerSendsPaise = process.env.PROVIDER_SENDS_PAISE === 'true') => {
    const n = Number(raw);
    if (isNaN(n) || n <= 0) return 0;
    // When provider explicitly sends paise (e.g. Razorpay), convert. Otherwise amount is in Rupees.
    return providerSendsPaise ? n / 100 : n;
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  HANDLER 1 — Wallet Topup                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

const AMOUNT_TOLERANCE = 0.5;
const amountMatches = (claimedAmt, bankAmt) =>
    !bankAmt || Math.abs(Number(claimedAmt) - Number(bankAmt)) <= AMOUNT_TOLERANCE;

/**
 * Atomically claims the BankCredit row for a UTR (creating it when a provider
 * webhook arrives without a forwarded SMS). Returns true only for the caller
 * that flipped isClaimed — a UTR can fund exactly one record.
 */
const claimBankCredit = async (utr, amount, userId) => {
    if (!utr) return true; // provider event keyed by our internal id only
    const BankCredit = require('../modules/payment/bankCredit.model');
    try {
        const bc = await BankCredit.findOneAndUpdate(
            { utr: String(utr), isClaimed: false },
            {
                $set: { isClaimed: true, claimedBy: userId, claimedAt: new Date() },
                $setOnInsert: { amount: Number(amount) || 0, source: 'WEBHOOK', receivedAt: new Date() }
            },
            { upsert: true, returnDocument: 'after' }
        );
        return Boolean(bc);
    } catch (err) {
        if (err.code === 11000) return false; // exists and already claimed
        throw err;
    }
};

const releaseBankCredit = async (utr, userId) => {
    if (!utr) return;
    const BankCredit = require('../modules/payment/bankCredit.model');
    await BankCredit.updateOne(
        { utr: String(utr), isClaimed: true, claimedBy: userId },
        { $set: { isClaimed: false }, $unset: { claimedBy: 1, claimedAt: 1 } }
    );
};

/**
 * Books a top-up WalletTxn that has ALREADY been atomically moved to COMPLETED
 * (by the webhook matcher or an admin approval). A plain top-up credits the
 * role's wallet (Shop.wallet for SHOP, Customer.wallet otherwise); a plan
 * purchase (txn.planId) activates the plan WITHOUT touching the wallet — the
 * money paid for the plan, exactly like a wallet purchase nets to zero.
 */
const applyConfirmedTopup = async ({ txn, amount, eventId, source = 'webhook' }) => {
    const userId = txn.userId;
    const user = await Customer.findById(userId).select('role name').lean();
    const isShop = user?.role === 'SHOP' || user?.role === 'SHOP_OWNER';
    let newBalance = 0;

    if (txn.planId) {
        if (isShop) {
            await _activateShopSubscription({ userId, planId: txn.planId, walletTxnId: txn._id, eventId, amount });
            const shop = await Shop.findOne({ ownerId: userId }).select('wallet').lean();
            newBalance = shop?.wallet?.balance || 0;
        } else {
            await _activateWorkerSubscription({ userId, planId: txn.planId, walletTxnId: txn._id, eventId, amount });
            const fresh = await Customer.findById(userId).select('wallet').lean();
            newBalance = fresh?.wallet?.balance || 0;
        }
        await WalletTxn.findByIdAndUpdate(txn._id, {
            $set: {
                type: 'SUBSCRIPTION',
                balance: newBalance,
                description: `Subscription Plan "${txn.planId}" paid via Direct UPI (verified by ${source})`
            }
        });
    } else if (isShop) {
        const updatedShop = await Shop.findOneAndUpdate(
            { ownerId: userId },
            { $inc: { 'wallet.balance': amount } },
            { returnDocument: 'after' }
        );
        newBalance = updatedShop?.wallet?.balance ?? amount;
        await WalletTxn.findByIdAndUpdate(txn._id, { $set: { balance: newBalance } });
    } else {
        const updatedUser = await Customer.findByIdAndUpdate(
            userId,
            { $inc: { 'wallet.balance': amount } },
            { returnDocument: 'after' }
        );
        newBalance = updatedUser?.wallet?.balance ?? amount;
        await WalletTxn.findByIdAndUpdate(txn._id, { $set: { balance: newBalance } });
    }

    await creditAdminTreasury({
        amount,
        description:    `${txn.planId ? `Plan "${txn.planId}" purchase` : 'Wallet topup'} verified by ${source} — ${user?.role || 'User'} ${user?.name || userId} (ref: ${eventId})`,
        referenceId:    txn._id,
        referenceModel: 'WalletTxn',
        type:           txn.planId ? 'PLATFORM_FEE_COLLECTED' : 'TOPUP'
    });

    await delCache(`session:${userId}`);
    await delCache('admin_dashboard_stats');

    await notifyUser({
        userId,
        title:   txn.planId ? 'Subscription Plan Activated! 🎉' : 'Wallet Topped Up ✓',
        message: txn.planId
            ? `Your payment of ₹${amount} was confirmed and your plan has been activated!`
            : `₹${amount} has been added to your Kwickly Wallet. New Balance: ₹${newBalance}`,
        type:    'WALLET_CREDIT',
        referenceId:    txn._id,
        referenceModel: 'WalletTxn',
        targetRole: user?.role || 'CUSTOMER'
    });

    const { emitToUser } = require('./socket.helper');
    const utr = txn.razorpayPaymentId || null;
    emitToUser(userId, 'WALLET_TOPUP_APPROVED', { amount, newBalance, txnId: txn._id, utr, planId: txn.planId || null });
    emitToUser(userId, 'WALLET_UPDATE', { balance: newBalance, amount, type: txn.planId ? 'SUBSCRIPTION' : 'TOPUP', txnId: txn._id, utr });
    emitToAll('DASHBOARD_UPDATE', { type: 'WALLET_TOPUP_APPROVED', txnId: txn._id, userId });

    return { newBalance, role: user?.role };
};

/**
 * Credits a top-up / UPI plan purchase ONLY when the bank event can be tied to
 * one specific record — by our internal reference (provider metadata) or by the
 * UTR the user submitted — and the bank amount matches within ₹0.50. There is
 * deliberately no "newest pending record with the same amount" fallback.
 *
 * @param {object} payload    - Normalised provider webhook payload
 * @param {string} eventId    - Provider's unique event/transaction ID (idempotency key)
 */
const handleWalletTopupWebhook = async (payload, eventId) => {
    const internalId = payload.metadata?.internalId || payload.internalId;
    const utr = payload.utr ? String(payload.utr).trim() : null;
    const bankAmount = payload.amount ? toRupees(payload.amount) : 0;

    if (!internalId && !utr && !eventId) {
        logger.warn(`[WebhookHandlers:WalletTopup] Missing identifier — eventId=${eventId}`);
        return;
    }

    try {
        let claimed = null;
        const validInternal = internalId && mongoose.isValidObjectId(internalId);

        // 1. Our own reference (WalletTxn id registered with the provider) or the UTR
        let candidate = null;
        if (validInternal) {
            candidate = await WalletTxn.findOne({ _id: internalId, type: 'TOPUP', status: { $ne: 'COMPLETED' } }).lean();
        }
        if (!candidate) {
            const refs = [utr, payload.transactionId, eventId].filter(Boolean).map(String);
            if (refs.length) {
                candidate = await WalletTxn.findOne({
                    type: 'TOPUP',
                    status: 'PENDING',
                    $or: [{ razorpayPaymentId: { $in: refs } }, { gatewayTransactionId: { $in: refs } }]
                }).sort('-createdAt').lean();
            }
        }

        if (candidate) {
            if (!amountMatches(candidate.amount, bankAmount)) {
                logger.warn(`[WebhookHandlers:WalletTopup] Amount mismatch for txn ${candidate._id}: claimed ₹${candidate.amount}, bank ₹${bankAmount} — held for admin`);
                return;
            }
            if (!(await claimBankCredit(utr, bankAmount || candidate.amount, candidate.userId))) {
                logger.info(`[WebhookHandlers:WalletTopup] UTR ${utr} already claimed — skipping txn ${candidate._id}`);
                return;
            }
            claimed = await WalletTxn.findOneAndUpdate(
                { _id: candidate._id, status: candidate.status },
                {
                    $set: {
                        status:               'COMPLETED',
                        amount:               bankAmount || candidate.amount,
                        gatewayTransactionId: eventId,
                        webhookEventId:       eventId,
                        verifiedAt:           new Date(),
                        ...(utr && !candidate.razorpayPaymentId ? { razorpayPaymentId: utr } : {})
                    }
                },
                { returnDocument: 'after' }
            );
            if (!claimed) {
                await releaseBankCredit(utr, candidate.userId);
                logger.info(`[WebhookHandlers:WalletTopup] Txn ${candidate._id} claimed concurrently — skipping`);
                return;
            }
            if (utr) {
                await Payment.updateMany(
                    { razorpayPaymentId: utr, status: { $ne: 'COMPLETED' }, 'metadata.notes.purpose': 'wallet_topup' },
                    { $set: { status: 'COMPLETED', verifiedAt: new Date() } }
                );
            }
        }

        // 2. A wallet_topup Payment intent (createOrder) referenced by our internal id
        if (!claimed && validInternal) {
            const OPEN = ['CREATED', 'PENDING', 'PENDING_VERIFICATION'];
            const payment = await Payment.findOne({ _id: internalId, status: { $in: OPEN }, 'metadata.notes.purpose': 'wallet_topup' }).lean();
            if (payment && payment.userId) {
                if (!amountMatches(payment.amount, bankAmount)) {
                    logger.warn(`[WebhookHandlers:WalletTopup] Amount mismatch for payment ${payment._id}: ₹${payment.amount} vs bank ₹${bankAmount} — held`);
                    return;
                }
                if (!(await claimBankCredit(utr, bankAmount || payment.amount, payment.userId))) return;
                const won = await Payment.findOneAndUpdate(
                    { _id: payment._id, status: { $in: OPEN } },
                    { $set: { status: 'COMPLETED', verifiedAt: new Date(), ...(utr ? { razorpayPaymentId: utr } : {}) } },
                    { returnDocument: 'after' }
                );
                if (!won) { await releaseBankCredit(utr, payment.userId); return; }
                const creditAmt = bankAmount || Number(payment.amount);
                claimed = await WalletTxn.create({
                    userId: payment.userId,
                    type: 'TOPUP',
                    amount: creditAmt,
                    balance: 0,
                    status: 'COMPLETED',
                    refId: String(payment._id),
                    razorpayPaymentId: utr || undefined,
                    gatewayTransactionId: eventId,
                    webhookEventId: eventId,
                    verifiedAt: new Date(),
                    description: `Wallet Top-up via Direct UPI (Verified by Bank)`
                });
            }
        }

        // 3. Bank SMS arrives after the customer submitted this UTR for a UPI shop order
        if (!claimed && utr) {
            const order = await ShopOrder.findOne({
                'payment.utrNumber': utr,
                'payment.method': 'UPI',
                'payment.status': { $in: ['PENDING', 'PENDING_VERIFICATION'] }
            }).select('_id total customerId').lean();
            if (order) {
                if (!amountMatches(order.total, bankAmount)) {
                    logger.warn(`[WebhookHandlers:WalletTopup] Amount mismatch for shop order ${order._id}: ₹${order.total} vs bank ₹${bankAmount} — held for admin`);
                    return;
                }
                if (!(await claimBankCredit(utr, bankAmount || order.total, order.customerId))) return;
                await handleShopOrderWebhook({ ...payload, metadata: { ...(payload.metadata || {}), internalId: String(order._id) } }, eventId);
                return;
            }
        }

        if (!claimed) {
            logger.info(`[WebhookHandlers:WalletTopup] No matching record (already processed or not found) — internalId=${internalId}, utr=${utr}, eventId=${eventId}`);
            return;
        }

        const amount = Number(claimed.amount);
        const { role } = await applyConfirmedTopup({ txn: claimed, amount, eventId, source: 'bank' });
        logger.info(`[WebhookHandlers:WalletTopup] ✓ ₹${amount} ${claimed.planId ? 'plan purchase' : 'credited'} for ${role || 'user'} ${claimed.userId} — eventId=${eventId}`);
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

        // Normal path — nothing is booked into the treasury here: the platform fee
        // (revenue) + GST (liability) are booked once at delivery settlement, the
        // same as for checkout bank-matched, admin-approved, wallet and cash orders.
        logger.info(`[WebhookHandlers:ShopOrder] Order ${claimed.orderNumber || internalId} paid via webhook — treasury booked at settlement`);

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

        // Notify shop owner (notifications are keyed by the owner's user id, not the shop id)
        const shopOwner = await Shop.findById(shopId).select('ownerId').lean();
        if (shopOwner?.ownerId) {
            await notifyUser({
                userId:   shopOwner.ownerId,
                title:    'New Order — Payment Received ✓',
                message:  `Order #${claimed.orderNumber} payment of ₹${amount} confirmed. Please prepare the order.`,
                action:   'ORDER_PLACED',
                entityType: 'ORDER',
                entityId: internalId,
                targetRole: 'SHOP'
            });
        }
        emitToRoom(`shop_${shopId}`, 'NEW_ORDER', { orderId: internalId, total: amount });

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
    handleFailedPaymentWebhook,
    creditAdminTreasury,
    applyConfirmedTopup
};
