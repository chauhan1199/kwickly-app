const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
    orderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'ShopOrder' },
    amount:   { type: Number, required: true },
    currency: { type: String, default: 'INR' },

    status: {
        type: String,
        enum: ['CREATED', 'PENDING', 'PENDING_VERIFICATION', 'WEBHOOK_RECEIVED', 'AUTHORIZED', 'CAPTURED', 'SUCCESS', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIAL_REFUNDED'],
        default: 'CREATED'
    },

    method:      { type: String },
    description: { type: String },
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    metadata:    { type: mongoose.Schema.Types.Mixed },

    // ── Automated UPI gateway fields ──────────────────────────────────────
    // gatewayOrderId   : provider's session/order ref returned at intent registration
    // gatewayTransactionId : provider's transaction ID from the webhook payload
    // webhookEventId   : provider's unique event ID — used as idempotency key
    // verifiedAt       : timestamp when the webhook confirmed the payment
    gatewayOrderId:       { type: String },   // replaces razorpayOrderId for new records
    gatewayTransactionId: { type: String },   // replaces razorpayPaymentId for new records
    webhookEventId:       { type: String },   // idempotency key (unique sparse index below)
    verifiedAt:           { type: Date },

    // ── Legacy fields (kept for backward-compat with in-flight orders) ────
    razorpayOrderId:   { type: String },      // was required+unique; now optional
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },

    refundId:      { type: String },
    refundAmount:  { type: Number },
    failureReason: { type: String }
}, { timestamps: true });

PaymentSchema.index({ razorpayPaymentId: 1 });
PaymentSchema.index({ razorpayOrderId: 1 }, { sparse: true }); // sparse index for unique/optional lookups
PaymentSchema.index({ gatewayOrderId:    1 });
PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ status: 1 });
// Unique sparse index — prevents double-processing of the same webhook event
PaymentSchema.index(
    { webhookEventId: 1 },
    { unique: true, sparse: true }
);

module.exports = mongoose.model('Payment', PaymentSchema);
