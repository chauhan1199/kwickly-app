const Joi = require('joi');

const createShopSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow(''),
    category: Joi.string().required(),
    address: Joi.string().required(),
    location: Joi.object({
        type: Joi.string().valid('Point').default('Point'),
        coordinates: Joi.array().items(Joi.number()).length(2).required()
    }).required(),
    delivery: Joi.object({
        fee: Joi.number().min(0).default(0),
        freeAbove: Joi.number().min(0).default(0),
        estimatedMinutes: Joi.number().min(0).default(30)
    }).optional()
});

const updateShopSchema = Joi.object({
    name: Joi.string().optional(),
    description: Joi.string().allow('').optional(),
    category: Joi.string().optional(),
    address: Joi.string().optional(),
    location: Joi.string().optional(), // In case it's sent as a stringified JSON due to form-data
    delivery: Joi.object({
        fee: Joi.number().min(0).optional(),
        freeAbove: Joi.number().min(0).optional(),
        estimatedMinutes: Joi.number().min(0).optional()
    }).optional()
});

const addPayoutMethodSchema = Joi.object({
    type: Joi.string().valid('BANK', 'UPI').required(),
    details: Joi.string().required(),
    isPrimary: Joi.boolean().optional()
});

const withdrawSchema = Joi.object({
    amount: Joi.number().min(1).required(),
    payoutMethod: Joi.string().required()
});

const updateOwnerSchema = Joi.object({
    name: Joi.string().required()
});

const reviewKycSchema = Joi.object({
    status: Joi.string().valid('APPROVED', 'REJECTED').required()
});

module.exports = {
    createShopSchema,
    updateShopSchema,
    addPayoutMethodSchema,
    withdrawSchema,
    updateOwnerSchema,
    reviewKycSchema
};
