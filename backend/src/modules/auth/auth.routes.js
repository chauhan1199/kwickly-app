const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const validate = require('../../middleware/validate.middleware');
const { loginSchema, sendOTPSchema, verifyOTPSchema, setPasswordSchema } = require('../../validators/auth.validator');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.post('/login', validate(loginSchema), authController.login);
router.post('/check-status', authController.checkStatus);
router.post('/send-otp', validate(sendOTPSchema), authController.sendOTP);
router.post('/verify-otp', validate(verifyOTPSchema), authController.verifyOTP);
router.patch('/set-password', authMiddleware, validate(setPasswordSchema), authController.setPassword);
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
