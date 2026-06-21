const Joi = require('joi');

const openDisputeSchema = Joi.object({
    jobId: Joi.string().optional(),
    shopOrderId: Joi.string().optional(),
    reason: Joi.string().required(),
    description: Joi.string().allow('').optional(),
    issue: Joi.string().allow('').optional()
}).or('jobId', 'shopOrderId');

module.exports = {
    openDisputeSchema
};
