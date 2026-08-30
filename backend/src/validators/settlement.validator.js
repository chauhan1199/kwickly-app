const Joi = require('joi');

// POST /:id/settle — amounts optional (controller falls back to stored values)
const settleSchema = Joi.object({
    shopAmount: Joi.number().min(0),
    commissionAmount: Joi.number().min(0),
    note: Joi.string().max(1000).allow('', null)
});

// POST /bulk-settle
const bulkSettleSchema = Joi.object({
    settlementIds: Joi.array().items(Joi.string()).required()
});

module.exports = {
    settleSchema,
    bulkSettleSchema
};
