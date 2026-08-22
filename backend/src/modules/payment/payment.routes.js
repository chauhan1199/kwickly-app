const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const validate = require('../../middleware/validate.middleware');
const { createOrderSchema, verifyPaymentSchema, refundPaymentSchema } = require('../../validators/payment.validator');

// Public - Razorpay webhook (no auth, no rate limit)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

// Authenticated routes
router.get('/admin-upi',        authMiddleware, paymentController.getAdminUpiConfig);
router.post('/create-order',    authMiddleware, validate(createOrderSchema), paymentController.createOrder);
router.post('/verify',          authMiddleware, validate(verifyPaymentSchema), paymentController.verifyPayment);
router.get('/history',          authMiddleware, paymentController.getPaymentHistory);
router.get('/:orderId',         authMiddleware, paymentController.getPaymentByOrder);


// Admin routes
router.post('/refund',          authMiddleware, authorize('ADMIN'), validate(refundPaymentSchema), paymentController.refundPayment);

module.exports = router;
