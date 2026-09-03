const express = require('express');
const router  = express.Router();
const paymentController = require('./payment.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const validate  = require('../../middleware/validate.middleware');
const { createOrderSchema, verifyPaymentSchema, refundPaymentSchema } = require('../../validators/payment.validator');

// ─── Public — UPI provider webhook (no auth, raw body for HMAC verification) ──
// Must be registered BEFORE any express.json() body-parser that would parse
// the body as a JS object and destroy the raw buffer needed for HMAC check.
router.post(
    '/free-upi-webhook',
    express.raw({ type: '*/*' }),
    paymentController.handleWebhook
);

// Backward-compat alias (some providers may still use the old path)
router.post(
    '/webhook',
    express.raw({ type: '*/*' }),
    paymentController.handleWebhook
);

// Authenticated routes
router.get('/admin-upi',        authMiddleware, paymentController.getAdminUpiConfig);
router.get('/status/:orderId',  authMiddleware, paymentController.checkPaymentStatus);
router.post('/create-order',    authMiddleware, validate(createOrderSchema), paymentController.createOrder);
router.post('/verify',          authMiddleware, validate(verifyPaymentSchema), paymentController.verifyPayment);
router.get('/history',          authMiddleware, paymentController.getPaymentHistory);
router.get('/:orderId',         authMiddleware, paymentController.getPaymentByOrder);

// Admin routes
router.post('/refund', authMiddleware, authorize('ADMIN'), validate(refundPaymentSchema), paymentController.refundPayment);

module.exports = router;
