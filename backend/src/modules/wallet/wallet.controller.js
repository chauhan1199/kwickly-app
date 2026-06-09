const { StatusCodes } = require('http-status-codes');
const WalletTxn  = require('./wallet.model');
const Customer   = require('../customer/customer.model');
const Payout     = require('../payout/payout.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToAll } = require('../../helpers/socket.helper');

/**
 * GET /api/v1/wallet/balance
 * Get current user's wallet balance + recent transactions
 */
exports.getWallet = catchAsync(async (req, res) => {
    const user = await Customer.findById(req.user._id).select('wallet name role');
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    const transactions = await WalletTxn.find({ userId: req.user._id })
        .sort('-createdAt')
        .limit(50);

    return successResponse(res, { balance: user.wallet.balance, transactions }, 'Wallet fetched');
});

/**
 * POST /api/v1/wallet/topup
 * Worker tops up their wallet
 */
exports.topupWallet = catchAsync(async (req, res) => {
    const { amount, paymentDetails, planId } = req.body;
    if (!amount || amount <= 0) {
        return errorResponse(res, 'Invalid top-up amount', StatusCodes.BAD_REQUEST);
    }

    const user = await Customer.findById(req.user._id);
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    let subscriptionUpdate = {};
    if (planId) {
        let days = 0;
        if (planId === 'monthly') days = 30;
        else if (planId === 'quarterly') days = 90;
        else if (planId === 'half') days = 180;
        else if (planId === 'yearly') days = 365;

        if (days > 0) {
            let currentExpiry = new Date();
            if (user.subscription?.expiryDate && user.subscription.expiryDate > new Date()) {
                currentExpiry = user.subscription.expiryDate;
            } else {
                const registrationDate = new Date(user.createdAt || Date.now());
                const trialEndDate = new Date(registrationDate.getTime() + 180 * 24 * 60 * 60 * 1000);
                if (trialEndDate > new Date()) {
                    currentExpiry = trialEndDate;
                }
            }
            const newExpiry = new Date(currentExpiry.getTime() + days * 24 * 60 * 60 * 1000);
            subscriptionUpdate = {
                'subscription.planId': planId,
                'subscription.expiryDate': newExpiry,
                'subscription.isTrial': false
            };
        }
    }

    // MOCK PAYMENT GATEWAY: Assuming successful payment via paymentDetails (e.g. Razorpay/UPI)
    const newBalance = user.wallet.balance + amount;
    await Customer.findByIdAndUpdate(req.user._id, { 
        'wallet.balance': newBalance,
        ...subscriptionUpdate
    });

    const txn = await WalletTxn.create({
        userId: req.user._id,
        type: 'TOPUP',
        amount,
        balance: newBalance,
        description: planId ? `Plan Top-up: ${planId}` : `Wallet Top-up via ${paymentDetails?.method || 'Online'}`
    });

    // We must return the updated user so frontend updates its auth state
    const updatedUser = await Customer.findById(req.user._id).select('-password');

    emitToAll('DASHBOARD_UPDATE', { type: 'WALLET_TOPUP', id: txn._id });
    return successResponse(res, { txn, user: updatedUser }, 'Wallet top-up successful');
});

/**
 * POST /api/v1/wallet/withdraw
 * Worker/Shop requests a payout withdrawal
 */
exports.requestWithdrawal = catchAsync(async (req, res) => {
    const { amount, payoutMethod } = req.body;

    const user = await Customer.findById(req.user._id);
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);
    if (user.wallet.balance < amount) {
        return errorResponse(res, 'Insufficient wallet balance', StatusCodes.PAYMENT_REQUIRED);
    }

    // Deduct from wallet
    const newBalance = user.wallet.balance - amount;
    await Customer.findByIdAndUpdate(req.user._id, { 'wallet.balance': newBalance });

    const txn = await WalletTxn.create({
        userId:      req.user._id,
        type:        'WITHDRAWAL',
        amount,
        balance:     newBalance,
        status:      'PENDING',
        description: `Withdrawal to ${payoutMethod || 'bank'}`
    });

    const paymentMethodType = (payoutMethod || '').toLowerCase().includes('upi') ? 'UPI' : 'BANK';
    await Payout.create({
        workerId: req.user._id,
        amount,
        paymentMethod: paymentMethodType,
        paymentDetails: payoutMethod || 'bank'
    });

    emitToAll('DASHBOARD_UPDATE', { type: 'WITHDRAWAL_REQUESTED', id: txn._id });
    return successResponse(res, txn, 'Withdrawal initiated');
});

/**
 * GET /api/v1/wallet/transactions (Admin — all transactions)
 */
exports.getAllTransactions = catchAsync(async (req, res) => {
    const { type, userId, page = 1, limit = 50 } = req.query;
    const query = {};
    if (type)   query.type   = type.toUpperCase();
    if (userId) query.userId = userId;

    const total = await WalletTxn.countDocuments(query);
    const txns  = await WalletTxn.find(query)
        .populate('userId', 'name phone role')
        .sort('-createdAt')
        .limit(limit * 1)
        .skip((page - 1) * limit);

    return successResponse(res, { txns, total, page, totalPages: Math.ceil(total / limit) }, 'Transactions fetched');
});

/**
 * POST /api/v1/wallet/credit (Admin manual credit/debit adjustment)
 */
exports.adminAdjust = catchAsync(async (req, res) => {
    const { userId, amount, type, description } = req.body;

    const user = await Customer.findById(userId);
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    const delta = type === 'ADJUSTMENT' && req.body.debit ? -Math.abs(amount) : Math.abs(amount);
    const newBalance = user.wallet.balance + delta;

    await Customer.findByIdAndUpdate(userId, { 'wallet.balance': newBalance });

    const txn = await WalletTxn.create({
        userId,
        type:        'ADJUSTMENT',
        amount:      Math.abs(amount),
        balance:     newBalance,
        description: description || 'Admin adjustment'
    });

    return successResponse(res, txn, 'Wallet adjusted');
});
