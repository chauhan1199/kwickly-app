const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const validate = require('../../middleware/validate.middleware');
const { loginSchema, sendOTPSchema, verifyOTPSchema, setPasswordSchema, forgotPasswordSchema, resetPasswordSchema } = require('../../validators/auth.validator');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { authLimiter, otpSendLimiter } = require('../../middleware/rateLimit.middleware');

// Apply strict rate limiters to sensitive auth routes
router.post('/login',        authLimiter, validate(loginSchema), authController.login);
router.post('/check-status', authLimiter, authController.checkStatus);
router.post('/send-otp',     otpSendLimiter, validate(sendOTPSchema), authController.sendOTP);
router.post('/verify-otp',   authLimiter, validate(verifyOTPSchema), authController.verifyOTP);

// Password reset
router.post('/forgot-password', otpSendLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password',  authLimiter, validate(resetPasswordSchema), authController.resetPassword);

// Authenticated routes
router.post('/logout',     authMiddleware, authController.logout);
router.patch('/set-password', authMiddleware, validate(setPasswordSchema), authController.setPassword);
router.get('/me',          authMiddleware, authController.getMe);

module.exports = router;
