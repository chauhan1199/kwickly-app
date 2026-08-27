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

const { generateUpiIntentUri, isValidUtr } = require('../../helpers/upi.helper');

exports.createRazorpayOrder = catchAsync(async (req, res) => {
    const { amount } = req.body;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return errorResponse(res, 'Invalid amount', StatusCodes.BAD_REQUEST);
    }

    const upiOrderId = `upi_admin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const adminWallet = await AdminWallet.findOne().lean();
    const platformVpa = adminWallet?.upiId || process.env.PLATFORM_UPI_ID || 'ganshyam.tech-1@oksbi';
    const payeeName = adminWallet?.bankDetails?.accountHolder || 'Kwickly Admin Treasury';

    const { uri: upiIntentUri } = generateUpiIntentUri({
        vpa: platformVpa,
        payeeName,
        amount: Number(amount),
        purpose: 'admin_wallet_topup',
        txnId: upiOrderId
    });

    return successResponse(res, {
        razorpayOrderId: upiOrderId,
        upiOrderId,
        amount: Math.round(Number(amount) * 100),
        currency: 'INR',
        upiVpa: platformVpa,
        payeeName,
        bankDetails: adminWallet?.bankDetails || null,
        upiIntentUri,
        isUpiDirect: true
    }, 'Direct UPI order created for wallet topup', StatusCodes.CREATED);
});

exports.verifyRazorpayPayment = catchAsync(async (req, res) => {
    const { razorpayPaymentId, utrNumber, upiTransactionId, amount: reqAmount } = req.body;
    const upiRef = (utrNumber || upiTransactionId || razorpayPaymentId || '').toString().trim();

    if (!upiRef || !isValidUtr(upiRef)) {
        return errorResponse(res, 'A valid 12-digit UPI Reference / UTR Number is required', StatusCodes.BAD_REQUEST);
    }

    const amount = Number(reqAmount) || 0;
    if (amount <= 0) {
        return errorResponse(res, 'Invalid topup amount', StatusCodes.BAD_REQUEST);
    }

    const wallet = await AdminWallet.findOneAndUpdate(
        {},
        { $inc: { balance: amount } },
        { returnDocument: 'after', upsert: true }
    );

    const txn = await AdminWalletTxn.create({
        type: 'TOPUP',
        amount,
        balanceAfter: wallet.balance,
        description: `Admin Treasury top-up via Direct UPI (UTR: ${upiRef})`,
        meta: { 
            performedBy: req.user._id,
            paymentMethod: 'UPI',
            utr: upiRef
        }
    });

    emitToAll('DASHBOARD_UPDATE', { type: 'ADMIN_WALLET_CREDIT', id: txn._id });
    return successResponse(res, { balance: wallet.balance, txn }, 'Wallet top-up credited successfully');
});
