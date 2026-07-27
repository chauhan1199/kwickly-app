const Joi = require('joi');
const logger = require('../helpers/logger.helper');
const { errorResponse } = require('../helpers/response.helper');

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
        logger.error('Settings validation failed:', error.details);
        return errorResponse(res, error.details[0].message, require('http-status-codes').StatusCodes.BAD_REQUEST);
    }
    next();
};

module.exports = {
    validateUpdateSettings
};
