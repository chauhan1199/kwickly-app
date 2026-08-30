const Joi = require('joi');

const createShopSchema = Joi.object({
    name: Joi.string().min(3).max(100).required().messages({
        'string.min': 'Shop name must be at least 3 characters',
        'any.required': 'Shop name is required'
    }),
    description: Joi.string().allow('').max(500),
    category: Joi.string().min(2).max(50).required().messages({
        'any.required': 'Category is required'
    }),
    address: Joi.string().min(3).max(200).required().messages({
        'string.min': 'Address must be at least 3 characters',
        'any.required': 'Address is required'
    }),
    location: Joi.object({
        type: Joi.string().valid('Point').default('Point'),
        coordinates: Joi.array().items(Joi.number()).length(2)
    }).optional(),
    delivery: Joi.object({
        fee: Joi.number().min(0).default(0),
        freeAbove: Joi.number().min(0).default(0),
        estimatedMinutes: Joi.number().min(0).default(30)
    }).optional()
});

const updateShopSchema = Joi.object({
    name: Joi.string().min(3).max(100).optional(),
    description: Joi.string().allow('', null).max(500).optional(),
    category: Joi.string().min(2).max(50).optional(),
    address: Joi.string().allow('', null).max(200).optional(),
    location: Joi.alternatives().try(
        Joi.string(),
        Joi.object({
            type: Joi.string().valid('Point').default('Point'),
            coordinates: Joi.array().items(Joi.number()).length(2)
        })
    ).optional(),
    delivery: Joi.object({
        fee: Joi.number().min(0).optional(),
        freeAbove: Joi.number().min(0).optional(),
        estimatedMinutes: Joi.number().min(0).optional()
    }).optional(),
    deliveryConfig: Joi.object({
        deliveryRadiusKm: Joi.number().min(0).optional(),
        minOrderAmount: Joi.number().min(0).optional(),
        freeDeliveryAbove: Joi.number().min(0).optional(),
        deliveryCharge: Joi.number().min(0).optional(),
        discountEnabled: Joi.boolean().optional(),
        discountAbove: Joi.number().min(0).optional(),
        discountType: Joi.string().valid('flat', 'percent').optional(),
        discountValue: Joi.number().min(0).optional(),
        discountPct: Joi.number().min(0).max(100).optional(),
        maxDiscountCap: Joi.number().min(0).optional(),
        sameDayDelivery: Joi.boolean().optional(),
        deliverySlots: Joi.array().items(Joi.object({
            label: Joi.string().optional(),
            slotOpen: Joi.string().optional(),
            slotClose: Joi.string().optional()
        })).optional()
    }).optional(),
    businessHours: Joi.object({
        monFri: Joi.string().max(50).optional(),
        sat: Joi.string().max(50).optional(),
        sun: Joi.string().max(50).optional()
    }).optional(),
    bannerUrl: Joi.string().allow('', null).optional(),
    bannerBase64: Joi.string().allow('', null).optional(),
    logoUrl: Joi.string().allow('', null).optional(),
    logoBase64: Joi.string().allow('', null).optional(),
    isOnline: Joi.boolean().optional(),
    // Owner-submitted KYC documents: controller sanitizes entries and forces status back to PENDING
    kyc: Joi.object({
        status: Joi.string().optional(),
        documents: Joi.array().items(
            Joi.object({
                name: Joi.string().allow('').optional(),
                url: Joi.string().required(),
                public_id: Joi.string().optional(),
                docType: Joi.string().optional(),
                type: Joi.string().optional()
            }).unknown(true)
        ).optional()
    }).optional()
}).min(1);


const createShopAdminSchema = Joi.object({
    name: Joi.string().min(3).max(100).required().messages({ 'any.required': 'Shop name is required' }),
    category: Joi.string().min(2).max(50).required().messages({ 'any.required': 'Category is required' }),
    description: Joi.string().allow('').max(500).optional(),
    address: Joi.string().min(3).max(200).required().messages({ 'any.required': 'Address is required' }),
    ownerName: Joi.string().min(2).max(100).optional(),
    ownerPhone: Joi.string().min(10).max(15).required().messages({ 'any.required': 'Owner phone is required' }),
    ownerEmail: Joi.string().email().optional().allow('', null),
    logoUrl: Joi.string().uri().optional().allow(''),
    location: Joi.object({
        type: Joi.string().valid('Point').default('Point'),
        coordinates: Joi.array().items(Joi.number()).length(2)
    }).optional(),
    delivery: Joi.object({
        radiusKm: Joi.number().min(0).max(100).optional(),
        fee: Joi.number().min(0).optional(),
        freeAbove: Joi.number().min(0).optional()
    }).optional(),
    deliveryConfig: Joi.object().unknown(true).optional(),
    businessHours: Joi.object({
        monFri: Joi.string().max(50).optional(),
        sat: Joi.string().max(50).optional(),
        sun: Joi.string().max(50).optional()
    }).optional(),
    subscription: Joi.object({
        plan: Joi.string().valid('FREE_TRIAL', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY').optional(),
        validUntil: Joi.date().optional()
    }).optional()
});

const updateShopAdminSchema = Joi.object({
    name: Joi.string().min(3).max(100).optional(),
    category: Joi.string().min(2).max(50).optional(),
    description: Joi.string().allow('').max(500).optional(),
    address: Joi.string().min(3).max(200).optional(),
    logoUrl: Joi.string().uri().optional().allow(''),
    location: Joi.object({
        type: Joi.string().valid('Point').default('Point'),
        coordinates: Joi.array().items(Joi.number()).length(2)
    }).optional(),
    delivery: Joi.object({
        radiusKm: Joi.number().min(0).max(100).optional(),
        fee: Joi.number().min(0).optional(),
        freeAbove: Joi.number().min(0).optional()
    }).optional(),
    deliveryConfig: Joi.object().unknown(true).optional(),
    businessHours: Joi.object({
        monFri: Joi.string().max(50).optional(),
        sat: Joi.string().max(50).optional(),
        sun: Joi.string().max(50).optional()
    }).optional(),
    subscription: Joi.object({
        planId: Joi.string().optional(),
        status: Joi.string().optional(),
        isTrial: Joi.boolean().optional()
    }).optional(),
    isOnline: Joi.boolean().optional()
}).min(1);

const shopWalletSchema = Joi.object({
    amount: Joi.number().min(1).required().messages({ 'any.required': 'Amount is required' }),
    description: Joi.string().max(200).optional()
});

const addPayoutMethodSchema = Joi.object({
    type: Joi.string().valid('BANK', 'UPI').required(),
    detail: Joi.string().required(),
    bankName: Joi.string().optional(),
    label: Joi.string().optional(),
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
    createShopAdminSchema,
    updateShopAdminSchema,
    shopWalletSchema,
    addPayoutMethodSchema,
    withdrawSchema,
    updateOwnerSchema,
    reviewKycSchema
};
