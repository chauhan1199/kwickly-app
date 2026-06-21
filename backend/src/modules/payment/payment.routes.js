const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');

// Public - Razorpay webhook (no auth, no rate limit)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

// Authenticated routes
router.post('/create-order',    authMiddleware, paymentController.createOrder);
router.post('/verify',          authMiddleware, paymentController.verifyPayment);
router.get('/history',          authMiddleware, paymentController.getPaymentHistory);
router.get('/:orderId',         authMiddleware, paymentController.getPaymentByOrder);

// Admin routes
router.post('/refund',          authMiddleware, authorize('ADMIN'), paymentController.refundPayment);

module.exports = router;
