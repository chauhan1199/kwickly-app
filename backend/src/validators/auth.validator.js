const Joi = require('joi');

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const passwordMessage = 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.';

const loginSchema = Joi.object({
    email: Joi.string().email().optional(),
    phone: Joi.string().min(10).max(15).optional(),
    password: Joi.string().min(4).max(64).optional(),
    mpin: Joi.string().min(4).max(6).optional(),
    role: Joi.string().valid('CUSTOMER', 'WORKER', 'ADMIN', 'SHOP').optional(),
    fcmToken: Joi.string().optional()
}).or('email', 'phone').or('password', 'mpin');

const sendOTPSchema = Joi.object({
    phone: Joi.string().min(10).max(15).required(),
    role: Joi.string().valid('CUSTOMER', 'WORKER', 'SHOP').required(),
    method: Joi.string().valid('SMS', 'WHATSAPP').optional()
});

const verifyOTPSchema = Joi.object({
    phone: Joi.string().min(10).max(15).required(),
    code: Joi.string().length(4).required(),
    role: Joi.string().valid('CUSTOMER', 'WORKER', 'SHOP').required(),
    name: Joi.string().min(2).optional(),
    fcmToken: Joi.string().optional()
});

const setPasswordSchema = Joi.object({
    password: Joi.string().min(4).max(64).optional(),
    mpin: Joi.string().pattern(/^\d{4,6}$/).optional().messages({
        'string.pattern.base': 'MPIN must be 4 to 6 numeric digits'
    })
}).or('password', 'mpin');

const setMpinSchema = Joi.object({
    mpin: Joi.string().pattern(/^\d{4,6}$/).required().messages({
        'string.pattern.base': 'MPIN must be 4 to 6 numeric digits'
    }),
    password: Joi.string().optional()
});

const forgotPasswordSchema = Joi.object({
    phone: Joi.string().min(10).max(15).required(),
    role: Joi.string().valid('CUSTOMER', 'WORKER', 'SHOP').default('CUSTOMER')
});

const resetPasswordSchema = Joi.object({
    phone: Joi.string().min(10).max(15).required(),
    code: Joi.string().length(4).required(),
    newPassword: Joi.string().min(4).max(64).optional(),
    newMpin: Joi.string().pattern(/^\d{4,6}$/).optional(),
    role: Joi.string().valid('CUSTOMER', 'WORKER', 'SHOP').default('CUSTOMER')
}).or('newPassword', 'newMpin');

const resetMpinSchema = Joi.object({
    phone: Joi.string().min(10).max(15).required(),
    code: Joi.string().length(4).required(),
    newMpin: Joi.string().pattern(/^\d{4,6}$/).required().messages({
        'string.pattern.base': 'MPIN must be 4 to 6 numeric digits'
    }),
    role: Joi.string().valid('CUSTOMER', 'WORKER', 'SHOP').default('CUSTOMER')
});

module.exports = {
    loginSchema,
    sendOTPSchema,
    verifyOTPSchema,
    setPasswordSchema,
    setMpinSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    resetMpinSchema
};
