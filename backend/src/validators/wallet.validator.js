const Joi = require('joi');

const topupSchema = Joi.object({
    amount: Joi.number().min(1).required(),
    paymentDetails: Joi.object({
        method: Joi.string().required(),
        txnId: Joi.string().optional()
    }).optional(),
    planId: Joi.string().optional(),
    razorpayOrderId: Joi.string().optional(),
    razorpayPaymentId: Joi.string().optional(),
    razorpaySignature: Joi.string().optional()
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
