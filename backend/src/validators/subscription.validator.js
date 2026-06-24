const Joi = require('joi');

const subscribeSchema = Joi.object({
    planId: Joi.string().required(),
    paymentId: Joi.string().allow('', null),
    targetRole: Joi.string().valid('WORKER', 'SHOP').default('WORKER')
});

const validateSubscribe = (req, res, next) => {
    const { error } = subscribeSchema.validate(req.body);
    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }
    next();
};

module.exports = {
    validateSubscribe
};
