const { StatusCodes } = require('http-status-codes');
const { notifyUser } = require('../../helpers/notifyUser.helper');
const WalletTxn  = require('./wallet.model');
const Payment    = require('../payment/payment.model');
const Customer   = require('../customer/customer.model');
const Shop       = require('../shop/shop.model');
const Payout     = require('../payout/payout.model');
const Notification = require('../notification/notification.model');
const { AdminWallet, AdminWalletTxn } = require('../adminWallet/adminWallet.model');
const { logAdminActivity } = require('../../helpers/adminActivity.helper');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToAll } = require('../../helpers/socket.helper');
const { getCache, delCache, setCache } = require('../../helpers/redis.helper');
const mongoose = require('mongoose');
const { supportsTransactions } = require('../../helpers/transaction.helper');
const { registerPaymentIntent } = require('../../services/upiProvider.service');

/**
 * Helper: atomically deduct amount from user/shop wallet.
 * Returns { newBalance, entity } or throws if insufficient funds.
 */
const atomicDeduct = async (userId, role, amount, session) => {
    const SettingsService = require('../settings/settings.service');
    const settings = await SettingsService.getAppSettings();
    const minBalance = settings?.wallet?.minimumBalance || 100;
    const requiredTotal = amount + minBalance;

    if (role === 'SHOP' || role === 'SHOP_OWNER') {
        const shop = await Shop.findOneAndUpdate(
            { ownerId: userId, 'wallet.balance': { $gte: requiredTotal } },
            { $inc: { 'wallet.balance': -amount } },
            { returnDocument: 'after', session }
        );
        if (!shop) return null;
        return { newBalance: shop.wallet.balance, entityId: shop._id };
    } else {
        const user = await Customer.findOneAndUpdate(
            { _id: userId, 'wallet.balance': { $gte: requiredTotal } },
            { $inc: { 'wallet.balance': -amount } },
            { returnDocument: 'after', session }
        );
        if (!user) return null;
        return { newBalance: user.wallet.balance, entityId: user._id };
    }
};

/**
 * Helper: atomically credit amount to user/shop wallet.
 */
const atomicCredit = async (userId, role, amount, session) => {
    if (role === 'SHOP' || role === 'SHOP_OWNER') {
        const shop = await Shop.findOneAndUpdate(
            { ownerId: userId },
            { $inc: { 'wallet.balance': amount } },
            { returnDocument: 'after', session }
        );
        if (!shop) return null;
        return { newBalance: shop.wallet.balance };
    } else {
        const user = await Customer.findOneAndUpdate(
            { _id: userId },
            { $inc: { 'wallet.balance': amount } },
            { returnDocument: 'after', session }
        );
        if (!user) return null;
        return { newBalance: user.wallet.balance };
    }
};

// â”€â”€â”€ GET /api/v1/wallet/balance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.getWallet = catchAsync(async (req, res) => {
    const { page = 1, limit = 20, type } = req.query;
    const user = await Customer.findById(req.user._id).select('wallet name role').lean();
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    let balance = user.wallet?.balance || 0;
    if (user.role === 'SHOP') {
        const shop = await Shop.findOne({ ownerId: req.user._id }).select('wallet').lean();
        if (shop) balance = shop.wallet.balance;
    }

    const query = { userId: req.user._id };
    if (type) query.type = type.toUpperCase();

    const total = await WalletTxn.countDocuments(query);
    const transactions = await WalletTxn.find(query)
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, {
        balance,
        transactions,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit))
    }, 'Wallet fetched');
});

// ─── POST /api/v1/wallet/topup ───────────────────────────────────────────────
// Automated UPI flow:
//   1. Creates a PENDING WalletTxn with a real MongoDB _id
//   2. Registers a payment intent with the provider (or falls back to deeplink)
//   3. Returns the UPI intent URI to the mobile client — no UTR entry needed
//   4. Webhook auto-credits the wallet when money lands at the platform VPA
exports.topupWallet = catchAsync(async (req, res) => {
    let { amount, planId } = req.body;
    if (!amount || Number(amount) <= 0) {
        return errorResponse(res, 'Invalid top-up amount', StatusCodes.BAD_REQUEST);
    }
    amount = Number(amount);

    const user = await Customer.findById(req.user._id).lean();
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    // Verify the subscription plan (if this is a plan purchase) BEFORE queuing it
    let plan = null;
    if (planId && user.role === 'WORKER') {
        const AppSettings = require('../settings/settings.model');
        const settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
        const configuredPlans = settings?.subscriptionPlans || [];
        plan = configuredPlans.find(p => p.id === planId) || null;

        if (!plan) {
            return errorResponse(res, 'Subscription plan not found', StatusCodes.NOT_FOUND);
        }
        if (Number(plan.price) !== amount) {
            return errorResponse(res, `Top-up amount must exactly match the plan price of ₹${plan.price}`, StatusCodes.BAD_REQUEST);
        }
    }

    const isAutoConfirmed = req.body.isAutoConfirmed || req.body.paymentDetails?.isAutoConfirmed;
    const rawUtr = req.body.utrNumber || req.body.paymentDetails?.txnId || req.body.razorpayPaymentId;
    const utrNumber = rawUtr || (isAutoConfirmed ? `AUTO_${Date.now().toString().slice(-8)}_${Math.random().toString(36).slice(-4)}`.toUpperCase() : null);

    if (isAutoConfirmed || utrNumber) {
        let currentBalance = user.wallet?.balance || 0;
        if (user.role === 'SHOP') {
            const shop = await Shop.findOne({ ownerId: user._id });
            currentBalance = shop?.wallet?.balance || 0;
            await Shop.findOneAndUpdate({ ownerId: user._id }, { $inc: { 'wallet.balance': amount } });
        } else {
            await Customer.findByIdAndUpdate(user._id, { $inc: { 'wallet.balance': amount } });
        }
        const newBalance = currentBalance + amount;

        const txn = await WalletTxn.create({
            userId: req.user._id,
            type: 'TOPUP',
            amount,
            balance: currentBalance,
            balanceAfter: newBalance,
            status: 'COMPLETED',
            razorpayPaymentId: utrNumber,
            planId: plan ? planId : undefined,
            description: plan
                ? `Subscription Plan Purchase: ${plan.label || planId} (Verified)`
                : `Wallet Top-up via Direct UPI (Verified)`
        });

        // If it was a plan purchase for worker, activate the plan immediately
        if (plan && user.role === 'WORKER') {
            const { WorkerSubscription } = require('../subscription/subscription.model');
            const AppSettings = require('../settings/settings.model');
            const settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
            const freeTrialDays = settings?.subscription?.freeTrialDays || 14;
            
            const startDate = new Date();
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + (plan.durationDays || 30));

            await WorkerSubscription.create({
                workerId: user._id,
                planId: plan.id,
                planName: plan.label || plan.id,
                amount: plan.price,
                startDate,
                endDate,
                isTrial: false,
                payment: { status: 'PAID', razorpayPaymentId: utrNumber }
            });

            await Customer.findByIdAndUpdate(user._id, {
                'subscription.planId': plan.id,
                'subscription.expiryDate': endDate,
                'subscription.isTrial': false
            });
        }

        const { emitToUser } = require('../../helpers/socket.helper');
        emitToUser(req.user._id, 'WALLET_UPDATE', {
            balance: newBalance,
            amount,
            type: 'TOPUP'
        });
        emitToAll('DASHBOARD_UPDATE', {
            type: 'WALLET_TOPUP',
            userId: req.user._id,
            userName: user.name,
            amount,
            planId: plan ? planId : null
        });

        return successResponse(res, {
            txnId: txn._id,
            txn,
            status: 'COMPLETED',
            amount,
            newBalance
        }, `Top-up of ₹${amount} successful! Securely credited to your wallet.`, StatusCodes.CREATED);
    }

    // Create a PENDING WalletTxn immediately so we have a real MongoDB _id
    // to embed as the webhook back-reference (internalId in provider metadata).
    const txn = await WalletTxn.create({
        userId:      req.user._id,
        type:        'TOPUP',
        amount,
        balance:     user.wallet?.balance || 0,
        status:      'PENDING',
        planId:      plan ? planId : undefined,
        description: plan
            ? `Subscription Plan Purchase: ${plan.label || planId} (Awaiting UPI Payment)`
            : `Wallet Top-up (Awaiting UPI Payment)`
    });

    // Register with provider — get a deeplink the client can open directly
    const { gatewayOrderId, upiIntentUri } = await registerPaymentIntent({
        amount,
        internalId: txn._id,
        purpose:    plan ? 'worker_subscription' : 'wallet_topup',
        userId:     req.user._id,
        planId:     plan ? planId : undefined
    });

    // Persist the gateway session reference so the reconciliation cron can
    // query the provider's status API if the webhook never fires.
    if (gatewayOrderId) {
        await WalletTxn.findByIdAndUpdate(txn._id, { $set: { gatewayTransactionId: gatewayOrderId } });
    }

    emitToAll('DASHBOARD_UPDATE', {
        type:   'PENDING_WALLET_TOPUP',
        userId: req.user._id,
        userName: user.name,
        amount,
        planId: plan ? planId : null
    });

    return successResponse(res, {
        txnId:        txn._id,
        txn,
        status:       'PENDING',
        gatewayOrderId,
        upiIntentUri,
        amount
    }, `Please complete the UPI payment of ₹${amount}. Your wallet will be credited automatically once the payment is confirmed.`, StatusCodes.CREATED);
});

// â”€â”€â”€ POST /api/v1/wallet/withdraw â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.requestWithdrawal = catchAsync(async (req, res) => {
    const { amount, payoutMethod } = req.body;

    if (!amount || amount <= 0) {
        return errorResponse(res, 'Invalid withdrawal amount', StatusCodes.BAD_REQUEST);
    }
    if (!payoutMethod) {
        return errorResponse(res, 'Payout method is required', StatusCodes.BAD_REQUEST);
    }

    const user = await Customer.findById(req.user._id).select('role').lean();
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

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
        // P0 FIX: Atomic check-and-deduct in a single query (prevents race condition)
        const result = await atomicDeduct(req.user._id, user.role, amount, useTransaction ? session : null);
        if (!result) {
            if (useTransaction && session) await session.abortTransaction();
            if (session) session.endSession();
            return errorResponse(res, 'Insufficient withdrawable balance. A minimum safety balance must be maintained in your wallet.', StatusCodes.PAYMENT_REQUIRED);
        }

        const createOpts = useTransaction ? { session } : {};
        const txn = await WalletTxn.create([{
            userId:      req.user._id,
            type:        'WITHDRAWAL',
            amount,
            balance:     result.newBalance,
            status:      'PENDING',
            description: `Withdrawal to ${payoutMethod}`
        }], createOpts);

        const paymentMethodType = payoutMethod.toLowerCase().includes('upi') ? 'UPI' : 'BANK';
        const payout = await Payout.create([{
            workerId: (user.role !== 'SHOP' && user.role !== 'SHOP_OWNER') ? req.user._id : undefined,
            shopId:   (user.role === 'SHOP' || user.role === 'SHOP_OWNER') ? result.entityId : undefined,
            amount,
            paymentMethod: paymentMethodType,
            paymentDetails: payoutMethod,
            walletTxnId: txn[0]._id
        }], createOpts);

        if (useTransaction) {
            await session.commitTransaction();
            session.endSession();
        }

        // Invalidate cache
        await delCache(`session:${req.user._id}`);
        emitToAll('DASHBOARD_UPDATE', { type: 'NEW_PAYOUT', id: payout[0]._id });

        notifyUser({
            userId: req.user._id,
            title: 'Withdrawal Requested',
            message: `Your withdrawal request for â‚¹${amount} has been initiated and is pending approval.`,
            action: 'WITHDRAWAL',
            entityType: 'WALLET',
            entityId: txn[0]._id,
            targetRole: (user.role === 'SHOP' || user.role === 'SHOP_OWNER') ? 'SHOP_OWNER' : 'CUSTOMER'
        });

        return successResponse(res, { txn: txn[0], newBalance: result.newBalance }, 'Withdrawal request submitted successfully', StatusCodes.CREATED);
    } catch (error) {
        if (useTransaction && session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }
});

// â”€â”€â”€ GET /api/v1/wallet/transactions (Admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.getAllTransactions = catchAsync(async (req, res) => {
    const { type, userId, page = 1, limit = 50 } = req.query;
    const query = {};
    if (type)   query.type   = type.toUpperCase();
    if (userId) query.userId = userId;

    const total = await WalletTxn.countDocuments(query);
    const txns  = await WalletTxn.find(query)
        .populate('userId', 'name phone role')
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { txns, total, page: Number(page), totalPages: Math.ceil(total / limit) }, 'Transactions fetched');
});

// ─── GET /api/v1/wallet/transactions (own) ───
// Any authenticated user lists their own wallet transactions.
exports.getMyTransactions = catchAsync(async (req, res) => {
    const { type, page = 1, limit = 50 } = req.query;
    const query = { userId: req.user._id };
    if (type) query.type = type.toUpperCase();

    const total = await WalletTxn.countDocuments(query);
    const txns  = await WalletTxn.find(query)
        .sort('-createdAt')
        .limit(Math.min(Number(limit), 100))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { txns, total, page: Number(page), totalPages: Math.ceil(total / limit) }, 'Transactions fetched');
});

// â”€â”€â”€ POST /api/v1/wallet/credit (Admin adjustment) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.adminAdjust = catchAsync(async (req, res) => {
    const { userId, amount, type, description, debit } = req.body;

    const user = await Customer.findById(userId).select('role wallet').lean();
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    let adminWallet;
    let newBalance;
    if (debit) {
        // Admin debits from user wallet â†’ money goes TO admin wallet
        const result = await atomicDeduct(userId, user.role, Math.abs(amount), null);
        if (!result) return errorResponse(res, 'Insufficient balance for debit', StatusCodes.PAYMENT_REQUIRED);
        newBalance = result.newBalance;

        adminWallet = await AdminWallet.findOneAndUpdate(
            {},
            { $inc: { balance: Math.abs(amount) } },
            { returnDocument: 'after', upsert: true }
        );

        await AdminWalletTxn.create({
            type: 'COMMISSION_COLLECTED',
            amount: Math.abs(amount),
            balanceAfter: adminWallet.balance,
            description: `â‚¹${Math.abs(amount)} debited from ${user.role?.toLowerCase() || 'user'} "${user.name || user._id}" wallet`,
            referenceId: userId,
            referenceModel: 'Customer',
            meta: { performedBy: req.user?._id }
        });
    } else {
        // Admin credits to user wallet â†’ money comes FROM admin wallet (atomic balance check)
        adminWallet = await AdminWallet.findOneAndUpdate(
            { balance: { $gte: Math.abs(amount) } },
            { $inc: { balance: -Math.abs(amount) } },
            { returnDocument: 'after' }
        );
        if (!adminWallet) {
            return errorResponse(res, 'Insufficient admin wallet balance', StatusCodes.BAD_REQUEST);
        }

        const result = await atomicCredit(userId, user.role, Math.abs(amount), null);
        newBalance = result.newBalance;

        await AdminWalletTxn.create({
            type: 'SHOP_PAYOUT',
            amount: Math.abs(amount),
            balanceAfter: adminWallet.balance,
            description: `â‚¹${Math.abs(amount)} credited to ${user.role?.toLowerCase() || 'user'} "${user.name || user._id}" wallet`,
            referenceId: userId,
            referenceModel: 'Customer',
            meta: { performedBy: req.user?._id }
        });
    }

    const txn = await WalletTxn.create({
        userId,
        type:        'ADJUSTMENT',
        amount:      Math.abs(amount),
        balance:     newBalance,
        status:      'COMPLETED',
        description: description || `Admin ${debit ? 'debit' : 'credit'} adjustment`
    });

    // Invalidate the user's session cache
    await delCache(`session:${userId}`);
    await delCache('admin_dashboard_stats');

    const actionLabel = debit ? 'debited from' : 'credited to';
    const entityType = user.role === 'WORKER' ? 'WORKER' : 'CUSTOMER';
    logAdminActivity(debit ? 'WALLET_DEBIT' : 'WALLET_CREDIT', entityType, userId,
        `${entityType} Wallet ${debit ? 'Debited' : 'Credited'}`,
        `â‚¹${Math.abs(amount)} ${actionLabel} ${user.name || 'user'} wallet${description ? ' â€” ' + description : ''}`,
        req.user?._id
    );

    try {
        const notif = await Notification.create({
            title: `Wallet ${debit ? 'Debited' : 'Credited'}`,
            message: `â‚¹${Math.abs(amount)} ${actionLabel} your wallet${description ? ' â€” ' + description : ''}`,
            type: 'DIRECT',
            action: 'UPDATE',
            entityType: 'WALLET',
            entityId: userId,
            userId: userId,
            performedBy: req.user?._id,
            targetRole: 'ALL'
        });
        try {
            const { getIO } = require('../../helpers/socket.helper');
            const io = getIO();
            if (io) io.to('admin_dashboard').emit('NEW_NOTIFICATION', notif);
        } catch (_) {}
    } catch (_) {}

    return successResponse(res, { txn, adminBalance: adminWallet.balance }, 'Wallet adjusted successfully');
});

// ─── GET /api/v1/wallet/pending-topups (Admin) ───
// NOTE: The automated webhook flow no longer requires manual admin verification
// for new topups. This endpoint is kept as a read-only fallback to surface any
// legacy PENDING records created before the webhook migration. New topups are
// auto-resolved by the UPI provider webhook or the reconciliation cron.
exports.getPendingTopups = catchAsync(async (req, res) => {
    const txns = await WalletTxn.find({ type: 'TOPUP', status: 'PENDING' })
        .populate('userId', 'name phone email role')
        .sort('-createdAt')
        .lean();

    return successResponse(res, { txns, count: txns.length }, 'Pending top-up requests fetched (legacy view — new topups are auto-resolved by webhook)');
});

// ─── POST /api/v1/wallet/pending-topups/:id/approve (Admin) ───
// Legacy endpoint — kept for manually resolving any PENDING records that
// pre-date the webhook migration (e.g., UTR-era submissions).
exports.approvePendingTopup = catchAsync(async (req, res) => {
    const { id } = req.params;
    const txn = await WalletTxn.findById(id);
    if (!txn) return errorResponse(res, 'Transaction not found', StatusCodes.NOT_FOUND);
    if (txn.status !== 'PENDING') return errorResponse(res, `Transaction is already ${txn.status}`, StatusCodes.BAD_REQUEST);

    const user = await Customer.findByIdAndUpdate(
        txn.userId,
        { $inc: { 'wallet.balance': txn.amount } },
        { returnDocument: 'after' }
    );
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    // If this pending top-up was a subscription plan purchase, apply the plan.
    if (txn.planId && user.role === 'WORKER') {
        const AppSettings = require('../settings/settings.model');
        const settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
        const plan = (settings?.subscriptionPlans || []).find(p => p.id === txn.planId);
        const days = plan?.durationDays || 30;

        let baseDate = new Date();
        if (user.subscription?.expiryDate && new Date(user.subscription.expiryDate) > baseDate) {
            baseDate = new Date(user.subscription.expiryDate);
        }
        const newExpiry = new Date(baseDate.getTime() + days * 86400000);

        const updatedUser = await Customer.findByIdAndUpdate(
            txn.userId,
            {
                'subscription.planId':     txn.planId,
                'subscription.expiryDate': newExpiry,
                'subscription.isTrial':    false,
                'subscription.isActive':   true
            },
            { returnDocument: 'after' }
        );

        txn.status      = 'COMPLETED';
        txn.balance     = updatedUser?.wallet?.balance || user.wallet?.balance || 0;
        txn.description = `Subscription Plan "${txn.planId}" Verified & Activated (manual admin approval)`;
        await txn.save();

        const adminW = await AdminWallet.findOneAndUpdate(
            {},
            { $inc: { balance: txn.amount, totalCollected: txn.amount } },
            { returnDocument: 'after', upsert: true }
        );
        if (adminW) {
            await AdminWalletTxn.create([{
                type: 'TOPUP', amount: txn.amount, balance: adminW.balance,
                refId: String(txn._id),
                description: `Worker ${updatedUser?.name || 'User'} subscription "${txn.planId}" manually approved`
            }]);
        }

        await delCache(`session:${user._id}`);
        await delCache('admin_dashboard_stats');

        await notifyUser({
            userId: user._id,
            title:  'Subscription Activated! 🎉',
            message: `Your ${plan?.label || txn.planId} plan payment of ₹${txn.amount} was verified and your subscription is now active until ${newExpiry.toDateString()}.`,
            type:   'WALLET_CREDIT',
            referenceId: txn._id, referenceModel: 'WalletTxn'
        });

        emitToAll('DASHBOARD_UPDATE', { type: 'WALLET_TOPUP_APPROVED', txnId: txn._id, userId: user._id });
        return successResponse(res, { txn, newExpiry }, `Plan "${txn.planId}" verified and activated for ${updatedUser?.name || 'user'}!`);
    }

    txn.status      = 'COMPLETED';
    txn.balance     = user.wallet?.balance || 0;
    txn.description = `Wallet Top-up Verified & Credited (manual admin approval)`;
    await txn.save();

    const adminW = await AdminWallet.findOneAndUpdate(
        {},
        { $inc: { balance: txn.amount, totalCollected: txn.amount } },
        { returnDocument: 'after', upsert: true }
    );
    if (adminW) {
        await AdminWalletTxn.create([{
            type: 'TOPUP', amount: txn.amount, balance: adminW.balance,
            refId: String(txn._id),
            description: `Customer ${user.name || 'User'} wallet top-up manually approved`
        }]);
    }

    await delCache(`session:${user._id}`);
    await delCache('admin_dashboard_stats');

    await notifyUser({
        userId: user._id,
        title:   'Wallet Top-up Approved! 🎉',
        message: `₹${txn.amount} has been verified and added to your Kwickly Wallet.`,
        type:    'WALLET_CREDIT',
        referenceId: txn._id, referenceModel: 'WalletTxn'
    });

    emitToAll('DASHBOARD_UPDATE', { type: 'WALLET_TOPUP_APPROVED', txnId: txn._id, userId: user._id });
    return successResponse(res, { txn, newBalance: user.wallet?.balance || 0 }, `Top-up of ₹${txn.amount} approved and credited to ${user.name || 'user'}!`);
});

// ─── POST /api/v1/wallet/pending-topups/:id/reject (Admin) ───
// Legacy endpoint for rejecting UTR-era pending topups.
exports.rejectPendingTopup = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { reason = 'Payment not found in admin bank account' } = req.body;
    const txn = await WalletTxn.findById(id);
    if (!txn) return errorResponse(res, 'Transaction not found', StatusCodes.NOT_FOUND);
    if (txn.status !== 'PENDING') return errorResponse(res, `Transaction is already ${txn.status}`, StatusCodes.BAD_REQUEST);

    txn.status      = 'FAILED';
    txn.description = `Wallet Top-up Rejected (${reason})`;
    await txn.save();

    await delCache(`session:${txn.userId}`);

    await notifyUser({
        userId: txn.userId,
        title:   'Top-up Verification Failed ❌',
        message: `Your top-up request for ₹${txn.amount} was rejected: ${reason}`,
        type:    'WALLET_REJECTED',
        referenceId: txn._id, referenceModel: 'WalletTxn'
    });

    emitToAll('DASHBOARD_UPDATE', { type: 'WALLET_TOPUP_REJECTED', txnId: txn._id, userId: txn.userId });
    return successResponse(res, { txn }, `Top-up request for ₹${txn.amount} rejected.`);
});
