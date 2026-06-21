const Joi = require('joi');

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
    role: Joi.string().valid('CUSTOMER', 'WORKER', 'SHOP').required()
});

const setPasswordSchema = Joi.object({
    password: Joi.string().min(6).required()
});

const forgotPasswordSchema = Joi.object({
    phone: Joi.string().min(10).max(15).required(),
    role: Joi.string().valid('CUSTOMER', 'WORKER', 'SHOP').default('CUSTOMER')
});

const resetPasswordSchema = Joi.object({
    phone: Joi.string().min(10).max(15).required(),
    code: Joi.string().length(4).required(),
    newPassword: Joi.string().min(6).required(),
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
