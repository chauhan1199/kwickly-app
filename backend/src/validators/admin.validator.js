const Joi = require('joi');

const updateKYCSchema = Joi.object({
    status: Joi.string().valid('APPROVED', 'REJECTED').required().messages({
        'any.only': 'Status must be either APPROVED or REJECTED',
        'any.required': 'Status is required'
    })
});

const toggleStatusSchema = Joi.object({
    status: Joi.string().valid('active', 'inactive').required().messages({
        'any.only': 'Status must be either active or inactive',
        'any.required': 'Status is required'
    })
});

module.exports = {
    updateKYCSchema,
    toggleStatusSchema
};
