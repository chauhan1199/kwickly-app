const Joi = require('joi');

// Create payment order schema
const createOrderSchema = Joi.object({
  amount: Joi.number().min(1).required(),
  currency: Joi.string().valid('INR').default('INR'),
  receipt: Joi.string().optional(),
  notes: Joi.object().optional(),
  orderId: Joi.string().optional().allow(null, ''),
  purpose: Joi.string().optional(),
  paymentMethod: Joi.string().optional(),
});

// Verify payment schema
const verifyPaymentSchema = Joi.object({
  razorpayOrderId: Joi.string().required(),
  razorpayPaymentId: Joi.string().optional().allow('', null),
  upiTransactionId: Joi.string().optional().allow('', null),
  utrNumber: Joi.string().optional().allow('', null),
  razorpaySignature: Joi.string().optional().allow('', null),
  orderId: Joi.string().optional().allow(null, ''),
  paymentType: Joi.string().optional().allow('', null),
  purpose: Joi.string().optional().allow('', null),
  amount: Joi.number().optional().allow(null),
}).unknown(true);

// Refund payment schema — matches refundPayment controller contract
const refundPaymentSchema = Joi.object({
  orderId: Joi.string().required(),
  amount: Joi.number().min(1).optional(),
  reason: Joi.string().min(3).max(500).optional(),
  notes: Joi.object().optional(),
});

// Update payment status schema
const updatePaymentStatusSchema = Joi.object({
  status: Joi.string().valid('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'PARTIAL_REFUNDED').required(),
  notes: Joi.string().max(500).optional(),
});

module.exports = {
  createOrderSchema,
  verifyPaymentSchema,
  refundPaymentSchema,
  updatePaymentStatusSchema,
};
