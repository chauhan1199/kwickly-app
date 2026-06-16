const Joi = require('joi');

const createUserSchema = Joi.object({
    name: Joi.string().min(2).max(100).pattern(/^[a-zA-Z\s]+$/).required().messages({
        'string.min': 'Name must be at least 2 characters',
        'string.pattern.base': 'Name should only contain letters and spaces',
        'string.empty': 'Name is required',
        'any.required': 'Name is required'
    }),
    phone: Joi.string().pattern(/^\d{10,15}$/).required().messages({
        'string.pattern.base': 'Phone must be 10-15 digits',
        'any.required': 'Phone number is required'
    }),
    email: Joi.string().email().allow('', null).optional(),
    role: Joi.string().valid('CUSTOMER', 'WORKER', 'ADMIN', 'SHOP').required(),
    password: Joi.string().min(6).optional(),
    city: Joi.string().max(100).optional(),
    bio: Joi.string().max(500).optional(),
    profileImage: Joi.string().uri().allow('', null).optional(),
    address: Joi.object({
        label: Joi.string().max(50).optional(),
        street: Joi.string().max(200).optional(),
        area: Joi.string().max(200).optional(),
        city: Joi.string().max(100).optional(),
        pincode: Joi.string().pattern(/^\d{4,10}$/).optional()
    }).optional(),
    location: Joi.object({
        latitude: Joi.number().min(-90).max(90).optional(),
        longitude: Joi.number().min(-180).max(180).optional()
    }).optional()
});

const updateUserSchema = Joi.object({
    name: Joi.string().min(2).max(100).pattern(/^[a-zA-Z\s]+$/).optional(),
    phone: Joi.string().pattern(/^\d{10,15}$/).optional(),
    email: Joi.string().email().allow('', null).optional(),
    city: Joi.string().max(100).optional(),
    bio: Joi.string().max(500).optional(),
    profileImage: Joi.string().uri().allow('', null).optional(),
    address: Joi.object({
        label: Joi.string().max(50).optional(),
        street: Joi.string().max(200).optional(),
        area: Joi.string().max(200).optional(),
        city: Joi.string().max(100).optional(),
        pincode: Joi.string().pattern(/^\d{4,10}$/).optional()
    }).optional(),
    location: Joi.object({
        latitude: Joi.number().min(-90).max(90).optional(),
        longitude: Joi.number().min(-180).max(180).optional()
    }).optional()
});

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
    createUserSchema,
    updateUserSchema,
    updateKYCSchema,
    toggleStatusSchema
};
