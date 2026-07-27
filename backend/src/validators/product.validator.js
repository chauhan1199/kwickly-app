const Joi = require('joi');

const createProductSchema = Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
        'string.min': 'Product name must be at least 2 characters',
        'any.required': 'Product name is required'
    }),
    description: Joi.string().allow('', null).max(500).optional(),
    category: Joi.string().allow('', null).max(50).default('General').optional(),
    price: Joi.number().min(0.01).required().messages({
        'number.min': 'Price must be greater than 0',
        'any.required': 'Price is required'
    }),
    stock: Joi.number().integer().min(0).default(0).messages({
        'number.min': 'Stock cannot be negative'
    }),
    unit: Joi.string().max(50).default('Piece').optional(),
    minQty: Joi.number().integer().min(1).default(1).messages({
        'number.min': 'Minimum quantity must be at least 1'
    }),
    brand: Joi.string().allow('', null).max(100).optional(),
    shopId: Joi.string().optional(),
    isAvailable: Joi.boolean().default(true),
    imageUrl: Joi.string().allow('', null).optional(),
    imageBase64: Joi.string().allow('', null).optional(),
    attributes: Joi.any().optional()
});

const updateProductSchema = Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    description: Joi.string().allow('', null).max(500).optional(),
    category: Joi.string().allow('', null).max(50).optional(),
    price: Joi.number().min(0.01).optional().messages({
        'number.min': 'Price must be greater than 0'
    }),
    stock: Joi.number().integer().min(0).optional().messages({
        'number.min': 'Stock cannot be negative'
    }),
    unit: Joi.string().max(50).optional(),
    minQty: Joi.number().integer().min(1).optional().messages({
        'number.min': 'Minimum quantity must be at least 1'
    }),
    brand: Joi.string().allow('', null).max(100).optional(),
    isAvailable: Joi.boolean().optional(),
    imageUrl: Joi.string().allow('', null).optional(),
    imageBase64: Joi.string().allow('', null).optional(),
    attributes: Joi.any().optional()
}).min(1);

module.exports = {
    createProductSchema,
    updateProductSchema
};
