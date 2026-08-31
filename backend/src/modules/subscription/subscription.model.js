const mongoose = require('mongoose');

const WorkerSubscriptionSchema = new mongoose.Schema({
    workerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    planId:    { type: String, required: true },
    planName:  { type: String },
    amount:    { type: Number, required: true },

    startDate: { type: Date, default: Date.now },
    endDate:   { type: Date, required: true },
    isTrial:   { type: Boolean, default: false },

    payment: {
        status:               { type: String, enum: ['PAID', 'PENDING', 'FAILED'], default: 'PAID' },
        razorpayOrderId:      { type: String },   // legacy — kept for backward compat
        razorpayPaymentId:    { type: String },   // legacy — kept for backward compat
        gatewayOrderId:       { type: String },   // provider session ref
        gatewayTransactionId: { type: String },   // provider txn ID from webhook
        webhookEventId:       { type: String },   // idempotency key
        verifiedAt:           { type: Date }      // webhook confirmation timestamp
    }
}, { timestamps: true });

WorkerSubscriptionSchema.index({ workerId: 1, endDate: -1 });
WorkerSubscriptionSchema.index({ 'payment.razorpayPaymentId': 1 }, { sparse: true }); // legacy UTR lookup
WorkerSubscriptionSchema.index({ 'payment.webhookEventId': 1 }, { unique: true, sparse: true }); // new idempotency

const ShopSubscriptionSchema = new mongoose.Schema({
    shopId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    planId:    { type: String, required: true },
    planName:  { type: String },
    amount:    { type: Number, required: true },

    startDate: { type: Date, default: Date.now },
    endDate:   { type: Date, required: true },
    isTrial:   { type: Boolean, default: false },

    payment: {
        status:               { type: String, enum: ['PAID', 'PENDING', 'FAILED'], default: 'PAID' },
        razorpayOrderId:      { type: String },   // legacy — kept for backward compat
        razorpayPaymentId:    { type: String },   // legacy — kept for backward compat
        gatewayOrderId:       { type: String },   // provider session ref
        gatewayTransactionId: { type: String },   // provider txn ID from webhook
        webhookEventId:       { type: String },   // idempotency key
        verifiedAt:           { type: Date }      // webhook confirmation timestamp
    }
}, { timestamps: true });

ShopSubscriptionSchema.index({ shopId: 1, endDate: -1 });
ShopSubscriptionSchema.index({ 'payment.razorpayPaymentId': 1 }, { sparse: true }); // legacy UTR lookup
ShopSubscriptionSchema.index({ 'payment.webhookEventId': 1 }, { unique: true, sparse: true }); // new idempotency

module.exports = {
    WorkerSubscription:     mongoose.model('WorkerSubscription',     WorkerSubscriptionSchema),
    ShopSubscription:       mongoose.model('ShopSubscription',       ShopSubscriptionSchema)
};
