const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopOrder' },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
        type: String,
        enum: ['CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIAL_REFUNDED'],
        default: 'CREATED'
    },
    method: { type: String },
    description: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
    refundId: { type: String },
    refundAmount: { type: Number },
    failureReason: { type: String },
    webhookEventId: { type: String }
}, { timestamps: true });

PaymentSchema.index({ razorpayOrderId: 1 });
PaymentSchema.index({ razorpayPaymentId: 1 });
PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ status: 1 });

module.exports = mongoose.model('Payment', PaymentSchema);
