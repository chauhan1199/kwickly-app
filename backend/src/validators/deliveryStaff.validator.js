const Joi = require('joi');

const phone = Joi.string().pattern(/^\d{10,15}$/)
    .messages({ 'string.pattern.base': 'Phone must be 10-15 digits' });

// POST / — name required, phone optional
const addStaffSchema = Joi.object({
    name: Joi.string().min(1).max(100).required().messages({
        'any.required': 'Staff name is required',
        'string.empty': 'Staff name is required',
        'string.base': 'Staff name is required'
    }),
    phone: phone.allow('', null)
});

// PATCH /:staffId — all optional, at least one field
const updateStaffSchema = Joi.object({
    name: Joi.string().min(1).max(100),
    phone: phone
}).min(1);

module.exports = {
    addStaffSchema,
    updateStaffSchema
};
