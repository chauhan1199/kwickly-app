const Joi = require('joi');

// POST /broadcast
const broadcastSchema = Joi.object({
    title: Joi.string().min(1).max(200).required(),
    message: Joi.string().min(1).max(1000).required(),
    targetRole: Joi.string().valid('CUSTOMER', 'WORKER', 'SHOP', 'ALL').default('ALL')
});

// POST /push-token
const pushTokenSchema = Joi.object({
    fcmToken: Joi.string().min(1).max(512).required()
});

module.exports = {
    broadcastSchema,
    pushTokenSchema
};
