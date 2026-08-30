const Joi = require('joi');

const positiveAmount = Joi.number().positive().required()
    .messages({ 'number.base': 'Amount must be a number', 'number.positive': 'Amount must be greater than 0' });

// POST /credit
const creditSchema = Joi.object({
    amount: positiveAmount,
    description: Joi.string().max(500).allow('', null),
    paymentMethod: Joi.string().max(50)
});

// POST /debit
const debitSchema = Joi.object({
    amount: positiveAmount,
    description: Joi.string().max(500).allow('', null)
});

// POST /razorpay-order
const razorpayOrderSchema = Joi.object({
    amount: positiveAmount
});

// POST /razorpay-verify — needs a valid 12-digit UTR/UPI reference + positive amount
const razorpayVerifySchema = Joi.object({
    utrNumber: Joi.string().pattern(/^\d{12}$/).allow('', null)
        .messages({ 'string.pattern.base': 'utrNumber must be a 12-digit UTR number' }),
    upiTransactionId: Joi.string().pattern(/^\d{12}$/).allow('', null)
        .messages({ 'string.pattern.base': 'upiTransactionId must be a 12-digit UTR number' }),
    razorpayPaymentId: Joi.string().max(100).allow('', null),
    amount: positiveAmount
}).or('utrNumber', 'upiTransactionId', 'razorpayPaymentId');

// PATCH /bank-details
const bankDetailsSchema = Joi.object({
    accountHolder: Joi.string().min(1).max(100).required(),
    accountNumber: Joi.string().pattern(/^\d{9,18}$/).required()
        .messages({ 'string.pattern.base': 'Account number must be 9-18 digits' }),
    ifscCode: Joi.string().pattern(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/).required()
        .messages({ 'string.pattern.base': 'Invalid IFSC code format' }),
    bankName: Joi.string().min(1).max(100).required(),
    upiId: Joi.string().pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z]+$/).allow('', null)
        .messages({ 'string.pattern.base': 'Invalid UPI ID format' })
});

module.exports = {
    creditSchema,
    debitSchema,
    razorpayOrderSchema,
    razorpayVerifySchema,
    bankDetailsSchema
};
