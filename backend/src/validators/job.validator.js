const Joi = require('joi');

const createJobSchema = Joi.object({
    category: Joi.string().required(),
    subcategory: Joi.string().optional(),
    description: Joi.string().max(1000).optional(),
    media: Joi.array().items(Joi.string().uri()).max(5).optional(),
    preferredDate: Joi.date().iso().optional(),
    timeSlot: Joi.string().valid('urgent', 'morning', 'afternoon', 'evening').optional(),
    location: Joi.object({
        type: Joi.string().valid('Point').default('Point'),
        coordinates: Joi.array().items(Joi.number()).length(2).required() // [longitude, latitude]
    }).required(),
    addressDetails: Joi.alternatives().try(
        Joi.string().max(500),
        Joi.object({
            city: Joi.string().allow(''),
            fullAddress: Joi.string().allow('')
        })
    ).optional(),
    city: Joi.string().optional()
});

module.exports = {
    createJobSchema
};
