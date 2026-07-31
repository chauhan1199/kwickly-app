const Joi = require('joi');

// Create payment order schema
const createOrderSchema = Joi.object({
  amount: Joi.number().min(1).required(),
  currency: Joi.string().valid('INR').default('INR'),
  receipt: Joi.string().optional(),
  notes: Joi.object().optional(),
  paymentMethod: Joi.string().valid('card', 'netbanking', 'upi', 'wallet').optional(),
});

// Verify payment schema
const verifyPaymentSchema = Joi.object({
  razorpayOrderId: Joi.string().required(),
  razorpayPaymentId: Joi.string().required(),
  razorpaySignature: Joi.string().required(),
  orderId: Joi.string().optional(),
  paymentType: Joi.string().valid('wallet_topup', 'order_payment', 'job_payment').optional(),
});

// Refund payment schema
const refundPaymentSchema = Joi.object({
  paymentId: Joi.string().required(),
  amount: Joi.number().min(1).required(),
  reason: Joi.string().min(10).max(500).required(),
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
