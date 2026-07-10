const Joi = require('joi');

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const passwordMessage = 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.';

const loginSchema = Joi.object({
    email: Joi.string().email().optional(),
    phone: Joi.string().min(10).max(15).optional(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('CUSTOMER', 'WORKER', 'ADMIN', 'SHOP').optional()
}).or('email', 'phone');

const sendOTPSchema = Joi.object({
    phone: Joi.string().min(10).max(15).required(),
    role: Joi.string().valid('CUSTOMER', 'WORKER', 'SHOP').required()
});

const verifyOTPSchema = Joi.object({
    phone: Joi.string().min(10).max(15).required(),
    code: Joi.string().length(4).required(),
    role: Joi.string().valid('CUSTOMER', 'WORKER', 'SHOP').required(),
    name: Joi.string().min(2).optional()
});

const setPasswordSchema = Joi.object({
    password: Joi.string().pattern(passwordRegex).required().messages({
        'string.pattern.base': passwordMessage
    })
});

const forgotPasswordSchema = Joi.object({
    phone: Joi.string().min(10).max(15).required(),
    role: Joi.string().valid('CUSTOMER', 'WORKER', 'SHOP').default('CUSTOMER')
});

const resetPasswordSchema = Joi.object({
    phone: Joi.string().min(10).max(15).required(),
    code: Joi.string().length(4).required(),
    newPassword: Joi.string().pattern(passwordRegex).required().messages({
        'string.pattern.base': passwordMessage
    }),
    role: Joi.string().valid('CUSTOMER', 'WORKER', 'SHOP').default('CUSTOMER')
});

module.exports = {
    loginSchema,
    sendOTPSchema,
    verifyOTPSchema,
    setPasswordSchema,
    forgotPasswordSchema,
    resetPasswordSchema
};
