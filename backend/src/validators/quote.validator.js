const Joi = require('joi');

// POST / — worker places a quote (amount >= 10 enforced by controller)
const placeQuoteSchema = Joi.object({
    jobId: Joi.string().required(),
    amount: Joi.number().min(10).required()
        .messages({ 'number.min': 'Quote amount must be at least ₹10' }),
    description: Joi.string().max(2000).allow('', null),
    timeToReach: Joi.string().max(100).allow('', null),
    workerLocation: Joi.object({
        type: Joi.string(),
        coordinates: Joi.array().items(Joi.number())
    }).unknown(true).allow(null)
});

module.exports = {
    placeQuoteSchema
};
