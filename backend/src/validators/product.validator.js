const Joi = require('joi');

const createProductSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow(''),
    category: Joi.string().required(),
    price: Joi.number().min(0).required(),
    stock: Joi.number().integer().min(0).default(0),
    isAvailable: Joi.boolean().default(true)
});

const updateProductSchema = Joi.object({
    name: Joi.string().optional(),
    description: Joi.string().allow('').optional(),
    category: Joi.string().optional(),
    price: Joi.number().min(0).optional(),
    stock: Joi.number().integer().min(0).optional(),
    isAvailable: Joi.boolean().optional()
});

module.exports = {
    createProductSchema,
    updateProductSchema
};
