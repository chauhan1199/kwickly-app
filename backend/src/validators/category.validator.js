const Joi = require('joi');

const subcategorySchema = Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
        'string.min': 'Subcategory name must be at least 2 characters',
        'string.max': 'Subcategory name must not exceed 100 characters',
        'any.required': 'Subcategory name is required'
    }),
    minPrice: Joi.number().min(0).default(0),
    platformFee: Joi.number().min(0).default(50),
    suggestedMax: Joi.number().min(0).allow(null).default(null),
    active: Joi.boolean().default(true)
});

const createCategorySchema = Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
        'string.min': 'Category name must be at least 2 characters',
        'string.max': 'Category name must not exceed 100 characters',
        'any.required': 'Category name is required'
    }),
    description: Joi.string().required(),
    icon: Joi.string().required(),
    color: Joi.string().required(),
    active: Joi.boolean().default(true),
    subcategories: Joi.array().items(subcategorySchema).default([])
});

const updateCategorySchema = Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    description: Joi.string().optional(),
    icon: Joi.string().optional(),
    color: Joi.string().optional(),
    active: Joi.boolean().optional(),
    subcategories: Joi.array().items(subcategorySchema).optional()
}).min(1).messages({
    'object.min': 'At least one field must be provided for update'
});

const addSubcategorySchema = Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
        'string.min': 'Subcategory name must be at least 2 characters',
        'string.max': 'Subcategory name must not exceed 100 characters',
        'any.required': 'Subcategory name is required'
    }),
    minPrice: Joi.number().min(0).default(0),
    platformFee: Joi.number().min(0).default(50),
    suggestedMax: Joi.number().min(0).allow(null).default(null),
    active: Joi.boolean().default(true)
});

const updateSubcategorySchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    minPrice: Joi.number().min(0).optional(),
    platformFee: Joi.number().min(0).optional(),
    suggestedMax: Joi.number().min(0).allow(null).optional(),
    active: Joi.boolean().optional()
}).min(1);

module.exports = {
    createCategorySchema,
    updateCategorySchema,
    addSubcategorySchema,
    updateSubcategorySchema
};
