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
        status:            { type: String, enum: ['PAID', 'PENDING', 'FAILED'], default: 'PAID' },
        razorpayOrderId:   { type: String },
        razorpayPaymentId: { type: String }
    }
}, { timestamps: true });

WorkerSubscriptionSchema.index({ workerId: 1, endDate: -1 });
WorkerSubscriptionSchema.index({ 'payment.razorpayPaymentId': 1 }, { partialFilterExpression: { 'payment.razorpayPaymentId': { $type: 'string' } } }); // cross-flow UTR replay lookup

const ShopSubscriptionSchema = new mongoose.Schema({
    shopId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    planId:    { type: String, required: true },
    planName:  { type: String },
    amount:    { type: Number, required: true },

    startDate: { type: Date, default: Date.now },
    endDate:   { type: Date, required: true },
    isTrial:   { type: Boolean, default: false },

    payment: {
        status:            { type: String, enum: ['PAID', 'PENDING', 'FAILED'], default: 'PAID' },
        razorpayOrderId:   { type: String },
        razorpayPaymentId: { type: String }
    }
}, { timestamps: true });

ShopSubscriptionSchema.index({ shopId: 1, endDate: -1 });
ShopSubscriptionSchema.index({ 'payment.razorpayPaymentId': 1 }, { partialFilterExpression: { 'payment.razorpayPaymentId': { $type: 'string' } } }); // cross-flow UTR replay lookup

module.exports = {
    WorkerSubscription:     mongoose.model('WorkerSubscription',     WorkerSubscriptionSchema),
    ShopSubscription:       mongoose.model('ShopSubscription',       ShopSubscriptionSchema)
};
