const { StatusCodes } = require('http-status-codes');
const { AdminWallet, AdminWalletTxn } = require('./adminWallet.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToAll } = require('../../helpers/socket.helper');
const {
    getOrCreateWallet,
    collectCommission,
    collectPlatformFee,
    debitForPayout,
} = require('./adminWallet.service');

exports.getBalance = catchAsync(async (req, res) => {
    const wallet = await getOrCreateWallet();
    return successResponse(res, {
        balance: wallet.balance,
        bankDetails: wallet.bankDetails,
        upiId: wallet.upiId
    }, 'Admin wallet fetched');
});

exports.getTransactions = catchAsync(async (req, res) => {
    const { type, page = 1, limit = 50 } = req.query;
    const query = {};
    if (type && type !== 'all') query.type = type.toUpperCase();

    const total = await AdminWalletTxn.countDocuments(query);
    const txns = await AdminWalletTxn.find(query)
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { txns, total, page: Number(page), totalPages: Math.ceil(total / limit) }, 'Admin wallet transactions fetched');
});

exports.credit = catchAsync(async (req, res) => {
    const { amount, description, paymentMethod } = req.body;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return errorResponse(res, 'Invalid amount', StatusCodes.BAD_REQUEST);
    }

    const wallet = await AdminWallet.findOneAndUpdate(
        {},
        { $inc: { balance: Number(amount) } },
        { returnDocument: 'after', upsert: true }
    );

    const txn = await AdminWalletTxn.create({
        type: 'MANUAL_CREDIT',
        amount: Number(amount),
        balanceAfter: wallet.balance,
        description: description || 'Manual credit by admin',
        meta: { 
            performedBy: req.user._id,
            paymentMethod: paymentMethod || 'CASH'
        }
    });

    emitToAll('DASHBOARD_UPDATE', { type: 'ADMIN_WALLET_CREDIT', id: txn._id });
    return successResponse(res, { balance: wallet.balance, txn }, 'Wallet credited successfully');
});

exports.debit = catchAsync(async (req, res) => {
    const { amount, description } = req.body;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return errorResponse(res, 'Invalid amount', StatusCodes.BAD_REQUEST);
    }

    const wallet = await AdminWallet.findOneAndUpdate(
        { balance: { $gte: Number(amount) } },
        { $inc: { balance: -Number(amount) } },
        { returnDocument: 'after' }
    );
    if (!wallet) {
        return errorResponse(res, 'Insufficient admin wallet balance', StatusCodes.PAYMENT_REQUIRED);
    }

    const txn = await AdminWalletTxn.create({
        type: 'MANUAL_DEBIT',
        amount: Number(amount),
        balanceAfter: wallet.balance,
        description: description || 'Manual debit by admin',
        meta: { performedBy: req.user._id }
    });

    emitToAll('DASHBOARD_UPDATE', { type: 'ADMIN_WALLET_DEBIT', id: txn._id });
    return successResponse(res, { balance: wallet.balance, txn }, 'Wallet debited successfully');
});

exports.updateBankDetails = catchAsync(async (req, res) => {
    const { accountHolder, accountNumber, ifscCode, bankName, upiId } = req.body;

    if (!accountHolder || !accountHolder.trim()) {
        return errorResponse(res, 'Account holder name is required', StatusCodes.BAD_REQUEST);
    }
    if (!accountNumber || !/^\d{9,18}$/.test(accountNumber.trim())) {
        return errorResponse(res, 'Account number must be 9-18 digits', StatusCodes.BAD_REQUEST);
    }
    if (!ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifscCode.trim())) {
        return errorResponse(res, 'Invalid IFSC code format', StatusCodes.BAD_REQUEST);
    }
    if (!bankName || !bankName.trim()) {
        return errorResponse(res, 'Bank name is required', StatusCodes.BAD_REQUEST);
    }
    if (upiId && upiId.trim() && !/^[a-zA-Z0-9._-]+@[a-zA-Z]+$/.test(upiId.trim())) {
        return errorResponse(res, 'Invalid UPI ID format', StatusCodes.BAD_REQUEST);
    }

    const wallet = await getOrCreateWallet();
    wallet.bankDetails.accountHolder = accountHolder.trim();
    wallet.bankDetails.accountNumber = accountNumber.trim();
    wallet.bankDetails.ifscCode = ifscCode.trim().toUpperCase();
    wallet.bankDetails.bankName = bankName.trim();
    if (upiId !== undefined) wallet.upiId = upiId.trim();

    await wallet.save();
    return successResponse(res, {
        balance: wallet.balance,
        bankDetails: wallet.bankDetails,
        upiId: wallet.upiId
    }, 'Bank details updated');
});

exports.collectCommission = collectCommission;
exports.collectPlatformFee = collectPlatformFee;
exports.debitForPayout = debitForPayout;

const { createRazorpayOrder, verifyPaymentSignature, fetchPayment } = require('../../helpers/razorpay.helper');

exports.createRazorpayOrder = catchAsync(async (req, res) => {
    const { amount } = req.body;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return errorResponse(res, 'Invalid amount', StatusCodes.BAD_REQUEST);
    }

    try {
        const rpOrder = await createRazorpayOrder(amount, 'wallet_topup_' + Date.now(), { purpose: 'Admin Wallet Topup' });
        return successResponse(res, {
            razorpayOrderId: rpOrder.id,
            amount: rpOrder.amount,
            currency: rpOrder.currency,
            keyId: process.env.RAZORPAY_KEY_ID
        }, 'Razorpay order created for wallet topup', StatusCodes.CREATED);
    } catch (error) {
        return errorResponse(res, error.message || 'Failed to create Razorpay order', StatusCodes.INTERNAL_SERVER_ERROR);
    }
});

exports.verifyRazorpayPayment = catchAsync(async (req, res) => {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return errorResponse(res, 'Missing payment verification fields', StatusCodes.BAD_REQUEST);
    }

    const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
        return errorResponse(res, 'Invalid payment signature', StatusCodes.BAD_REQUEST);
    }

    let rpPayment;
    try {
        rpPayment = await fetchPayment(razorpayPaymentId);
    } catch (e) {
        return errorResponse(res, 'Failed to verify payment with Razorpay', StatusCodes.BAD_REQUEST);
    }

    if (rpPayment.status !== 'captured') {
        return errorResponse(res, 'Payment not captured in Razorpay', StatusCodes.BAD_REQUEST);
    }

    const amount = rpPayment.amount / 100; // convert paise to rupees

    const wallet = await AdminWallet.findOneAndUpdate(
        {},
        { $inc: { balance: amount } },
        { returnDocument: 'after', upsert: true }
    );

    const txn = await AdminWalletTxn.create({
        type: 'TOPUP',
        amount,
        balanceAfter: wallet.balance,
        description: 'Wallet top-up via Razorpay',
        meta: { 
            performedBy: req.user._id,
            paymentMethod: 'RAZORPAY',
            razorpayOrderId,
            razorpayPaymentId
        }
    });

    emitToAll('DASHBOARD_UPDATE', { type: 'ADMIN_WALLET_CREDIT', id: txn._id });
    return successResponse(res, { balance: wallet.balance, txn }, 'Wallet top-up verified successfully');
});
