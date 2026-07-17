const Joi = require('joi');
const { validateRequest } = require('./auth.validator'); // Re-using validateRequest middleware pattern

const updateSettingsSchema = Joi.object({
    feeAmount: Joi.number().min(0),
    feeType: Joi.string().valid('flat', 'percentage'),
    qrExpiry: Joi.number().min(5),
    cashEnabled: Joi.boolean(),
    walletMinimum: Joi.number().min(0),
    topupPresets: Joi.string().regex(/^(\d+\s*,\s*)*\d+$/).allow(''), // comma separated numbers
    trialDays: Joi.number().min(0),
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
    termsOfService: Joi.string().allow(''),
    privacyPolicy: Joi.string().allow('')
}).min(1);

const validateUpdateSettings = (req, res, next) => {
    const { error } = updateSettingsSchema.validate(req.body);
    if (error) {
        console.error('Validation Error Details:', error.details);
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }
    next();
};

module.exports = {
    validateUpdateSettings
};
