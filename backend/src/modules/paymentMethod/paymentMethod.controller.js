const { StatusCodes } = require('http-status-codes');
const { BankAccount, UpiAccount } = require('./paymentMethod.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');

exports.getBankAccounts = catchAsync(async (req, res) => {
    const accounts = await BankAccount.find({ userId: req.user._id });
    return successResponse(res, accounts, 'Bank accounts fetched');
});

exports.addBankAccount = catchAsync(async (req, res) => {
    if (req.body.isDefault) {
        await BankAccount.updateMany({ userId: req.user._id }, { isDefault: false });
    }
    const account = await BankAccount.create({ ...req.body, userId: req.user._id });
    return successResponse(res, account, 'Bank account added', StatusCodes.CREATED);
});

exports.deleteBankAccount = catchAsync(async (req, res) => {
    const account = await BankAccount.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!account) return errorResponse(res, 'Account not found', StatusCodes.NOT_FOUND);
    return successResponse(res, null, 'Bank account deleted');
});

exports.setDefaultBank = catchAsync(async (req, res) => {
    await BankAccount.updateMany({ userId: req.user._id }, { isDefault: false });
    const account = await BankAccount.findOneAndUpdate(
        { _id: req.params.id, userId: req.user._id },
        { isDefault: true },
        { new: true }
    );
    if (!account) return errorResponse(res, 'Account not found', StatusCodes.NOT_FOUND);
    return successResponse(res, account, 'Default bank updated');
});

exports.getUpiAccounts = catchAsync(async (req, res) => {
    const accounts = await UpiAccount.find({ userId: req.user._id });
    return successResponse(res, accounts, 'UPI accounts fetched');
});

exports.addUpiAccount = catchAsync(async (req, res) => {
    if (req.body.isDefault) {
        await UpiAccount.updateMany({ userId: req.user._id }, { isDefault: false });
    }
    const account = await UpiAccount.create({ ...req.body, userId: req.user._id });
    return successResponse(res, account, 'UPI account added', StatusCodes.CREATED);
});

exports.deleteUpiAccount = catchAsync(async (req, res) => {
    const account = await UpiAccount.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!account) return errorResponse(res, 'Account not found', StatusCodes.NOT_FOUND);
    return successResponse(res, null, 'UPI account deleted');
});

exports.setDefaultUpi = catchAsync(async (req, res) => {
    await UpiAccount.updateMany({ userId: req.user._id }, { isDefault: false });
    const account = await UpiAccount.findOneAndUpdate(
        { _id: req.params.id, userId: req.user._id },
        { isDefault: true },
        { new: true }
    );
    if (!account) return errorResponse(res, 'Account not found', StatusCodes.NOT_FOUND);
    return successResponse(res, account, 'Default UPI updated');
});
