const Joi = require('joi');

const addressSchema = Joi.object({
    label: Joi.string().max(50).optional(),
    street: Joi.string().max(200).optional(),
    area: Joi.string().max(200).optional(),
    city: Joi.string().max(100).optional(),
    pincode: Joi.string().pattern(/^\d{4,10}$/).optional()
}).optional();

const locationSchema = Joi.object({
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional()
}).optional();

const serviceSchema = Joi.object({
    category: Joi.string().optional(),
    subcategories: Joi.array().items(Joi.string()).optional(),
    isActive: Joi.boolean().optional()
}).optional();

const bankDetailsSchema = Joi.object({
    accountNumber: Joi.string().max(20).allow('', null).optional(),
    ifscCode: Joi.string().max(15).allow('', null).optional(),
    bankName: Joi.string().max(100).allow('', null).optional()
}).optional();

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
    email: Joi.string().email().allow('', null).optional().messages({
        'string.email': 'Enter a valid email address'
    }),
    role: Joi.string().valid('CUSTOMER', 'WORKER', 'ADMIN', 'SHOP').required(),
    password: Joi.string().min(6).optional().messages({
        'string.min': 'Password must be at least 6 characters'
    }),
    city: Joi.string().max(100).optional(),
    bio: Joi.string().max(500).optional().messages({
        'string.max': 'Bio must be under 500 characters'
    }),
    profileImage: Joi.string().uri().allow('', null).optional(),
    address: addressSchema,
    location: locationSchema,
    services: Joi.array().items(serviceSchema).optional(),
    serviceRadius: Joi.number().min(1).max(100).optional().messages({
        'number.min': 'Service radius must be at least 1 km',
        'number.max': 'Service radius cannot exceed 100 km',
        'number.base': 'Service radius must be a number'
    }),
    wallet: Joi.object({
        bankDetails: bankDetailsSchema,
        upiId: Joi.string().max(50).allow('', null).optional()
    }).optional()
});

const updateUserSchema = Joi.object({
    name: Joi.string().min(2).max(100).pattern(/^[a-zA-Z\s]+$/).optional().messages({
        'string.min': 'Name must be at least 2 characters',
        'string.pattern.base': 'Name should only contain letters and spaces'
    }),
    phone: Joi.string().pattern(/^\d{10,15}$/).optional().messages({
        'string.pattern.base': 'Phone must be 10-15 digits'
    }),
    email: Joi.string().email().allow('', null).optional().messages({
        'string.email': 'Enter a valid email address'
    }),
    city: Joi.string().max(100).optional(),
    bio: Joi.string().max(500).optional().messages({
        'string.max': 'Bio must be under 500 characters'
    }),
    profileImage: Joi.string().uri().allow('', null).optional(),
    address: addressSchema,
    location: locationSchema,
    services: Joi.array().items(serviceSchema).optional(),
    serviceRadius: Joi.number().min(1).max(100).optional().messages({
        'number.min': 'Service radius must be at least 1 km',
        'number.max': 'Service radius cannot exceed 100 km',
        'number.base': 'Service radius must be a number'
    }),
    wallet: Joi.object({
        bankDetails: bankDetailsSchema,
        upiId: Joi.string().max(50).allow('', null).optional()
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

const adminCreateJobSchema = Joi.object({
    customerId: Joi.string().required().messages({ 'any.required': 'Customer ID is required' }),
    category: Joi.string().required().messages({ 'any.required': 'Category is required' }),
    subcategory: Joi.string().optional(),
    description: Joi.string().max(1000).optional(),
    media: Joi.array().items(Joi.string().uri()).max(5).optional(),
    preferredDate: Joi.date().iso().optional(),
    timeSlot: Joi.string().valid('urgent', 'morning', 'afternoon', 'evening').optional(),
    location: Joi.object({
        type: Joi.string().valid('Point').default('Point'),
        coordinates: Joi.array().items(Joi.number()).length(2).required()
    }).optional(),
    addressDetails: Joi.string().max(255).optional()
});

const adminUpdateJobSchema = Joi.object({
    category: Joi.string().optional(),
    subcategory: Joi.string().optional().allow('', null),
    description: Joi.string().max(1000).optional().allow('', null),
    preferredDate: Joi.date().iso().optional().allow(null),
    timeSlot: Joi.string().valid('urgent', 'morning', 'afternoon', 'evening').optional().allow('', null),
    addressDetails: Joi.string().max(255).optional().allow('', null)
}).min(1);

const adminCreateOrderSchema = Joi.object({
    customerId: Joi.string().required().messages({ 'any.required': 'Customer ID is required' }),
    shopId: Joi.string().required().messages({ 'any.required': 'Shop ID is required' }),
    items: Joi.array().items(
        Joi.object({
            productId: Joi.string().required(),
            name: Joi.string().required(),
            price: Joi.number().required().min(0),
            qty: Joi.number().integer().required().min(1),
            imageUrl: Joi.string().allow('', null).optional()
        })
    ).min(1).required(),
    deliveryAddress: Joi.string().required(),
    deliveryLocation: Joi.object({
        type: Joi.string().valid('Point').default('Point'),
        coordinates: Joi.array().items(Joi.number()).length(2).required()
    }).required(),
    paymentMethod: Joi.string().valid('WALLET', 'UPI', 'CASH').default('WALLET')
});

module.exports = {
    createUserSchema,
    updateUserSchema,
    updateKYCSchema,
    toggleStatusSchema,
    adminCreateJobSchema,
    adminUpdateJobSchema,
    adminCreateOrderSchema
};
