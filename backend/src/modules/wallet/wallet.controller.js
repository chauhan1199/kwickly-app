const { StatusCodes } = require('http-status-codes');
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
const { delCache, setCache } = require('../../helpers/redis.helper');
const mongoose = require('mongoose');

/**
 * Helper: atomically deduct amount from user/shop wallet.
 * Returns { newBalance, entity } or throws if insufficient funds.
 */
const atomicDeduct = async (userId, role, amount, session) => {
    if (role === 'SHOP') {
        const shop = await Shop.findOneAndUpdate(
            { ownerId: userId, 'wallet.balance': { $gte: amount } },
            { $inc: { 'wallet.balance': -amount } },
            { new: true, session }
        );
        if (!shop) return null;
        return { newBalance: shop.wallet.balance, entityId: shop._id };
    } else {
        const user = await Customer.findOneAndUpdate(
            { _id: userId, 'wallet.balance': { $gte: amount } },
            { $inc: { 'wallet.balance': -amount } },
            { new: true, session }
        );
        if (!user) return null;
        return { newBalance: user.wallet.balance, entityId: user._id };
    }
};

/**
 * Helper: atomically credit amount to user/shop wallet.
 */
const atomicCredit = async (userId, role, amount, session) => {
    if (role === 'SHOP') {
        const shop = await Shop.findOneAndUpdate(
            { ownerId: userId },
            { $inc: { 'wallet.balance': amount } },
            { new: true, session }
        );
        if (!shop) return null;
        return { newBalance: shop.wallet.balance };
    } else {
        const user = await Customer.findOneAndUpdate(
            { _id: userId },
            { $inc: { 'wallet.balance': amount } },
            { new: true, session }
        );
        if (!user) return null;
        return { newBalance: user.wallet.balance };
    }
};

// ─── GET /api/v1/wallet/balance ───────────────────────────────────────────────
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

// ─── POST /api/v1/wallet/topup ────────────────────────────────────────────────
exports.topupWallet = catchAsync(async (req, res) => {
    const { amount, paymentDetails, planId } = req.body;
    if (!amount || amount <= 0) {
        return errorResponse(res, 'Invalid top-up amount', StatusCodes.BAD_REQUEST);
    }

    const user = await Customer.findById(req.user._id);
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    // Handle subscription plan extension
    let subscriptionUpdate = {};
    if (planId && user.role === 'WORKER') {
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

    // Invalidate user session cache so balance is fresh
    await delCache(`session:${req.user._id}`);
    emitToAll('DASHBOARD_UPDATE', { type: 'WALLET_TOPUP', id: txn._id });

    return successResponse(res, { txn, newBalance: result.newBalance }, 'Wallet top-up successful');
});

// ─── POST /api/v1/wallet/withdraw ─────────────────────────────────────────────
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

    const isSingle = mongoose.connection.client.topology.s.description.type === 'Single';
    const session = isSingle ? null : await mongoose.startSession();
    if (session) session.startTransaction();

    try {
        // P0 FIX: Atomic check-and-deduct in a single query (prevents race condition)
        const result = await atomicDeduct(req.user._id, user.role, amount, session);
        if (!result) {
            if (session) await session.abortTransaction();
            if (session) session.endSession();
            return errorResponse(res, 'Insufficient wallet balance', StatusCodes.PAYMENT_REQUIRED);
        }

        const txn = await WalletTxn.create([{
            userId:      req.user._id,
            type:        'WITHDRAWAL',
            amount,
            balance:     result.newBalance,
            status:      'PENDING',
            description: `Withdrawal to ${payoutMethod}`
        }], { session });

        const paymentMethodType = payoutMethod.toLowerCase().includes('upi') ? 'UPI' : 'BANK';
        await Payout.create([{
            workerId: user.role !== 'SHOP' ? req.user._id : undefined,
            shopId:   user.role === 'SHOP' ? result.entityId : undefined,
            amount,
            paymentMethod: paymentMethodType,
            paymentDetails: payoutMethod,
            walletTxnId: txn[0]._id
        }], { session });

        if (session) await session.commitTransaction();
        if (session) session.endSession();

        // Invalidate cache
        await delCache(`session:${req.user._id}`);
        emitToAll('DASHBOARD_UPDATE', { type: 'WITHDRAWAL_REQUESTED', id: txn[0]._id });

        return successResponse(res, txn[0], 'Withdrawal initiated successfully');
    } catch (error) {
        if (session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }
});

// ─── GET /api/v1/wallet/transactions (Admin) ──────────────────────────────────
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

// ─── POST /api/v1/wallet/credit (Admin adjustment) ────────────────────────────
exports.adminAdjust = catchAsync(async (req, res) => {
    const { userId, amount, type, description, debit } = req.body;

    const user = await Customer.findById(userId).select('role wallet');
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    let adminWallet = await AdminWallet.findOne();
    if (!adminWallet) adminWallet = await AdminWallet.create({ balance: 0 });

    let newBalance;
    if (debit) {
        // Admin debits from user wallet → money goes TO admin wallet
        const result = await atomicDeduct(userId, user.role, Math.abs(amount), null);
        if (!result) return errorResponse(res, 'Insufficient balance for debit', StatusCodes.PAYMENT_REQUIRED);
        newBalance = result.newBalance;

        adminWallet.balance += Math.abs(amount);
        await adminWallet.save();

        await AdminWalletTxn.create({
            type: 'COMMISSION_COLLECTED',
            amount: Math.abs(amount),
            balanceAfter: adminWallet.balance,
            description: `₹${Math.abs(amount)} debited from ${user.role?.toLowerCase() || 'user'} "${user.name || user._id}" wallet`,
            referenceId: userId,
            referenceModel: 'Customer',
            meta: { performedBy: req.user?._id }
        });
    } else {
        // Admin credits to user wallet → money comes FROM admin wallet
        if (adminWallet.balance < Math.abs(amount)) {
            return errorResponse(res, `Insufficient admin wallet balance. Available: ₹${adminWallet.balance}`, StatusCodes.BAD_REQUEST);
        }

        const result = await atomicCredit(userId, user.role, Math.abs(amount), null);
        newBalance = result.newBalance;

        adminWallet.balance -= Math.abs(amount);
        await adminWallet.save();

        await AdminWalletTxn.create({
            type: 'SHOP_PAYOUT',
            amount: Math.abs(amount),
            balanceAfter: adminWallet.balance,
            description: `₹${Math.abs(amount)} credited to ${user.role?.toLowerCase() || 'user'} "${user.name || user._id}" wallet`,
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
        `₹${Math.abs(amount)} ${actionLabel} ${user.name || 'user'} wallet${description ? ' — ' + description : ''}`,
        req.user?._id
    );

    try {
        const notif = await Notification.create({
            title: `Wallet ${debit ? 'Debited' : 'Credited'}`,
            message: `₹${Math.abs(amount)} ${actionLabel} your wallet${description ? ' — ' + description : ''}`,
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
