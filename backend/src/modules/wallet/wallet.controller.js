const { StatusCodes } = require('http-status-codes');
const { notifyUser } = require('../../helpers/notifyUser.helper');
const WalletTxn  = require('./wallet.model');
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
const { verifyPaymentSignature, fetchPayment } = require('../../helpers/razorpay.helper');
const { supportsTransactions } = require('../../helpers/transaction.helper');

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
    const user = await Customer.findById(req.user._id).select('wallet name role');
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    let balance = user.wallet?.balance || 0;
    if (user.role === 'SHOP') {
        const shop = await Shop.findOne({ ownerId: req.user._id }).select('wallet');
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

// â”€â”€â”€ POST /api/v1/wallet/topup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.topupWallet = catchAsync(async (req, res) => {
    let { amount, paymentDetails, planId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!amount || amount <= 0) {
        return errorResponse(res, 'Invalid top-up amount', StatusCodes.BAD_REQUEST);
    }

    if (razorpayOrderId && razorpayPaymentId && razorpaySignature) {
        const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
        if (!isValid) {
            return errorResponse(res, 'Invalid payment signature', StatusCodes.BAD_REQUEST);
        }
        try {
            const rpPayment = await fetchPayment(razorpayPaymentId);
            if (rpPayment.status !== 'captured') {
                return errorResponse(res, 'Payment not captured in Razorpay', StatusCodes.BAD_REQUEST);
            }
            amount = rpPayment.amount / 100; // Trust the captured amount from Razorpay
        } catch (error) {
            return errorResponse(res, 'Failed to verify payment with Razorpay', StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    const user = await Customer.findById(req.user._id);
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    // Handle subscription plan extension â€” requires payment verification first
    let subscriptionUpdate = {};
    if (planId && user.role === 'WORKER') {
        // Must have verified Razorpay payment to get subscription benefits
        if (!razorpayOrderId || !razorpayPaymentId) {
            return errorResponse(res, 'Subscription plan requires verified Razorpay payment', StatusCodes.BAD_REQUEST);
        }
        const planDays = { monthly: 30, quarterly: 90, half: 180, yearly: 365 };
        const days = planDays[planId] || 0;
        if (days > 0) {
            let baseDate = new Date();
            if (user.subscription?.expiryDate && user.subscription.expiryDate > new Date()) {
                baseDate = user.subscription.expiryDate;
            }
            const newExpiry = new Date(baseDate.getTime() + days * 86400000);
            subscriptionUpdate = {
                'subscription.planId': planId,
                'subscription.expiryDate': newExpiry,
                'subscription.isTrial': false
            };
        }
    }

    // Atomic credit
    const result = await atomicCredit(req.user._id, user.role, amount, null);
    if (!result) return errorResponse(res, 'Wallet credit failed', StatusCodes.INTERNAL_SERVER_ERROR);

    // Apply subscription update if any
    if (Object.keys(subscriptionUpdate).length > 0) {
        await Customer.findByIdAndUpdate(req.user._id, subscriptionUpdate);
    }

    const txn = await WalletTxn.create({
        userId: req.user._id,
        type: 'TOPUP',
        amount,
        balance: result.newBalance,
        status: 'COMPLETED',
        description: planId ? `Plan Top-up: ${planId}` : `Wallet Top-up via ${paymentDetails?.method || 'Online'}`
    });

    const adminWallet = await AdminWallet.findOneAndUpdate(
        {},
        { $inc: { balance: amount } },
        { returnDocument: 'after', upsert: true }
    );

    await AdminWalletTxn.create({
        type: 'TOPUP',
        amount,
        balanceAfter: adminWallet.balance,
        description: `Wallet top-up by ${user.role} ${user.name || user._id}`,
        referenceId: req.user._id,
        referenceModel: 'Customer'
    });


    // Invalidate user session cache so balance is fresh
    await delCache(`session:${req.user._id}`);
    await delCache('admin_dashboard_stats');
    
    emitToAll('DASHBOARD_UPDATE', { type: 'WALLET_TOPUP', id: txn._id });

    notifyUser({
        userId: req.user._id,
        title: 'Wallet Top-up Successful',
        message: `Successfully added â‚¹${amount} to your wallet.`,
        action: 'TOPUP',
        entityType: 'WALLET',
        entityId: txn._id,
        targetRole: (user.role === 'SHOP' || user.role === 'SHOP_OWNER') ? 'SHOP_OWNER' : 'CUSTOMER'
    });

    return successResponse(res, { txn, newBalance: result.newBalance }, 'Wallet top-up successful');
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

    const user = await Customer.findById(req.user._id).select('role');
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

// â”€â”€â”€ POST /api/v1/wallet/credit (Admin adjustment) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.adminAdjust = catchAsync(async (req, res) => {
    const { userId, amount, type, description, debit } = req.body;

    const user = await Customer.findById(userId).select('role wallet');
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
