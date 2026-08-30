const Joi = require('joi');

// PATCH /:id/status
const updatePayoutStatusSchema = Joi.object({
    status: Joi.string()
        .valid('APPROVED', 'TRANSFERRED', 'REJECTED')
        .insensitive()
        .required(),
    txnId: Joi.string().pattern(/^\d{12}$/).allow('', null)
        .messages({ 'string.pattern.base': 'txnId must be a 12-digit UTR number' }),
    rejectReason: Joi.string().max(500).allow('', null)
}).min(1);

module.exports = {
    updatePayoutStatusSchema
};
