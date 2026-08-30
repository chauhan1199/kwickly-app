const Joi = require('joi');
const { errorResponse } = require('../helpers/response.helper');
const { StatusCodes } = require('http-status-codes');

const subscribeSchema = Joi.object({
    planId: Joi.string().required(),
    paymentId: Joi.string().allow('', null),
    targetRole: Joi.string().valid('WORKER', 'SHOP').default('WORKER'),
    razorpayOrderId: Joi.string().optional(),
    razorpayPaymentId: Joi.string().optional(),
    razorpaySignature: Joi.string().optional(),
    utrNumber: Joi.string().allow('', null).optional(),
    paymentMethod: Joi.string().valid('UPI', 'WALLET').default('UPI')
});

const validateSubscribe = (req, res, next) => {
    const { error } = subscribeSchema.validate(req.body);
    if (error) {
        return errorResponse(res, error.details[0].message, StatusCodes.BAD_REQUEST);
    }
    next();
};

module.exports = {
    validateSubscribe
};
