const Joi = require('joi');
const logger = require('../helpers/logger.helper');
const { errorResponse } = require('../helpers/response.helper');

const updateSettingsSchema = Joi.object({
    feeAmount: Joi.number().min(0),
<<<<<<< Updated upstream
    feeType: Joi.string().valid('flat', 'percent'),
    gstPercentage: Joi.number().min(0),
=======
    feeType: Joi.string().valid('flat', 'percent', 'percentage'),
    gstPercentage: Joi.number().min(0).max(100),
>>>>>>> Stashed changes
    qrExpiry: Joi.number().min(5),
    cashEnabled: Joi.boolean(),
    walletMinimum: Joi.number().min(0),
    topupPresets: Joi.string().regex(/^(\d+\s*,\s*)*\d+$/).allow(''), // comma separated numbers
<<<<<<< Updated upstream
    freeTrialDays: Joi.number().min(0),
=======
    freeTrialDays: Joi.number().min(0).max(365),   // ← was missing (frontend key)
    trialDays: Joi.number().min(0),                 // ← legacy alias kept
>>>>>>> Stashed changes
    maxRadius: Joi.number().min(1).max(100),
    radiusRound1Wait: Joi.number().min(1),
    radiusRound2Wait: Joi.number().min(1),
    otpValidity: Joi.number().min(1),
    otpMaxAttempts: Joi.number().min(1),
    otpResendCooldown: Joi.number().min(10),
    maintenanceMode: Joi.boolean(),
    maintenanceMsg: Joi.string().allow(''),
    appName: Joi.string().min(1).max(50),
    logoUrl: Joi.string().uri().allow(''),
    iconUrl: Joi.string().uri().allow(''),
    monthlyPlan: Joi.number().min(0),
    semiPlan: Joi.number().min(0),
    annualPlan: Joi.number().min(0),
<<<<<<< Updated upstream
    subscriptionPlans: Joi.array().items(
        Joi.object({
            id: Joi.string().required(),
            label: Joi.string().allow(''),
            name: Joi.string().allow(''),
            price: Joi.number().required(),
            durationDays: Joi.number().required(),
            features: Joi.array().items(Joi.string()).default([]),
            isActive: Joi.boolean().default(true),
            targetRole: Joi.string().valid('WORKER', 'SHOP').default('WORKER')
        })
    ),
=======
    subscriptionPlans: Joi.array().items(Joi.object().unknown(true)), // ← was missing
>>>>>>> Stashed changes
    termsOfService: Joi.string().allow(''),
    privacyPolicy: Joi.string().allow('')
}).min(1).unknown(true); // allow future keys without breaking validation


const validateUpdateSettings = (req, res, next) => {
    const { error } = updateSettingsSchema.validate(req.body);
    if (error) {
        logger.error('Settings validation failed:', error.details);
        return errorResponse(res, error.details[0].message, require('http-status-codes').StatusCodes.BAD_REQUEST);
    }
    next();
};

module.exports = {
    validateUpdateSettings
};
