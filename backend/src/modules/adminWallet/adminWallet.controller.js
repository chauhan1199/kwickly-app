const { StatusCodes } = require('http-status-codes');
const { AdminWallet, AdminWalletTxn } = require('./adminWallet.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToAll } = require('../../helpers/socket.helper');

const getOrCreateWallet = async () => {
    let wallet = await AdminWallet.findOne();
    if (!wallet) {
        wallet = await AdminWallet.create({ balance: 0 });
    }
    return wallet;
};

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
    const { amount, description } = req.body;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return errorResponse(res, 'Invalid amount', StatusCodes.BAD_REQUEST);
    }

    const wallet = await getOrCreateWallet();
    wallet.balance += Number(amount);
    await wallet.save();

    const txn = await AdminWalletTxn.create({
        type: 'MANUAL_CREDIT',
        amount: Number(amount),
        balanceAfter: wallet.balance,
        description: description || 'Manual credit by admin',
        meta: { performedBy: req.user._id }
    });

    emitToAll('DASHBOARD_UPDATE', { type: 'ADMIN_WALLET_CREDIT', id: txn._id });
    return successResponse(res, { balance: wallet.balance, txn }, 'Wallet credited successfully');
});

exports.debit = catchAsync(async (req, res) => {
    const { amount, description } = req.body;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return errorResponse(res, 'Invalid amount', StatusCodes.BAD_REQUEST);
    }

    const wallet = await getOrCreateWallet();
    if (wallet.balance < Number(amount)) {
        return errorResponse(res, 'Insufficient admin wallet balance', StatusCodes.PAYMENT_REQUIRED);
    }

    wallet.balance -= Number(amount);
    await wallet.save();

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

exports.collectCommission = async (amount, description, referenceId, referenceModel, meta = {}) => {
    const wallet = await getOrCreateWallet();
    wallet.balance += Number(amount);
    await wallet.save();

    return AdminWalletTxn.create({
        type: 'COMMISSION_COLLECTED',
        amount: Number(amount),
        balanceAfter: wallet.balance,
        description,
        referenceId,
        referenceModel,
        meta
    });
};

exports.collectPlatformFee = async (amount, description, referenceId, referenceModel, meta = {}) => {
    const wallet = await getOrCreateWallet();
    wallet.balance += Number(amount);
    await wallet.save();

    return AdminWalletTxn.create({
        type: 'PLATFORM_FEE_COLLECTED',
        amount: Number(amount),
        balanceAfter: wallet.balance,
        description,
        referenceId,
        referenceModel,
        meta
    });
};

exports.debitForPayout = async (amount, description, referenceId, referenceModel, meta = {}) => {
    const wallet = await getOrCreateWallet();
    if (wallet.balance < Number(amount)) {
        throw new Error('Insufficient admin wallet balance for payout');
    }
    wallet.balance -= Number(amount);
    await wallet.save();

    return AdminWalletTxn.create({
        type: 'PAYOUT_DEBIT',
        amount: Number(amount),
        balanceAfter: wallet.balance,
        description,
        referenceId,
        referenceModel,
        meta
    });
};
