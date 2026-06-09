const Joi = require('joi');

const openDisputeSchema = Joi.object({
    jobId: Joi.string().optional(),
    shopOrderId: Joi.string().optional(),
    reason: Joi.string().required(),
    description: Joi.string().required()
}).or('jobId', 'shopOrderId'); // Must provide at least one

module.exports = {
    openDisputeSchema
};
