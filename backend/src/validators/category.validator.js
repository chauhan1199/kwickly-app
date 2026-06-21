const Joi = require('joi');

const subcategorySchema = Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
        'string.min': 'Subcategory name must be at least 2 characters',
        'string.max': 'Subcategory name must not exceed 100 characters',
        'any.required': 'Subcategory name is required'
    }),
    description: Joi.string().max(500).allow('').optional(),
    minPrice: Joi.number().min(0).max(999999).default(0),
    platformFee: Joi.number().min(0).max(999999).default(0),
    suggestedMax: Joi.number().min(0).max(999999).default(0),
    active: Joi.boolean().default(true)
});

const createCategorySchema = Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
        'string.min': 'Category name must be at least 2 characters',
        'string.max': 'Category name must not exceed 100 characters',
        'any.required': 'Category name is required'
    }),
    icon: Joi.string().max(10).required().messages({
        'any.required': 'Category icon is required'
    }),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).required().messages({
        'string.pattern.base': 'Color must be a valid hex color (e.g. #2563EB)',
        'any.required': 'Category color is required'
    }),
    description: Joi.string().min(5).max(500).required().messages({
        'string.min': 'Description must be at least 5 characters',
        'string.max': 'Description must not exceed 500 characters',
        'any.required': 'Category description is required'
    }),
    active: Joi.boolean().default(true),
    subcategories: Joi.array().items(subcategorySchema).default([])
});

const updateCategorySchema = Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    icon: Joi.string().max(10).optional(),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
    description: Joi.string().min(5).max(500).optional(),
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
    description: Joi.string().max(500).allow('').optional(),
    minPrice: Joi.number().min(0).max(999999).default(0),
    platformFee: Joi.number().min(0).max(999999).default(0),
    suggestedMax: Joi.number().min(0).max(999999).default(0),
    active: Joi.boolean().default(true)
});

module.exports = {
    createCategorySchema,
    updateCategorySchema,
    addSubcategorySchema
};
