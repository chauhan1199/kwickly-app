const Joi = require('joi');

const topupSchema = Joi.object({
    amount: Joi.number().min(1).required(),
    paymentDetails: Joi.object({
        method: Joi.string().required(),
        txnId: Joi.string().allow(null, '').optional()
    }).allow(null).optional(),
    planId: Joi.string().allow(null, '').optional(),
    razorpayOrderId: Joi.string().allow(null, '').optional(),
    razorpayPaymentId: Joi.string().allow(null, '').optional(),
    razorpaySignature: Joi.string().allow(null, '').optional()
});

const withdrawSchema = Joi.object({
    amount: Joi.number().min(1).required(),
    payoutMethod: Joi.string().required()
});

const adjustSchema = Joi.object({
    userId: Joi.string().required(),
    amount: Joi.number().min(1).required(),
    type: Joi.string().valid('ADJUSTMENT').required(),
    debit: Joi.boolean().default(false),
    description: Joi.string().optional()
});

module.exports = {
    topupSchema,
    withdrawSchema,
    adjustSchema
};
