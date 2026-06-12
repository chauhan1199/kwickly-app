const mongoose = require('mongoose');

const SubscriptionPlanSchema = new mongoose.Schema({
    name:         { type: String, required: true },      // "Monthly", "Quarterly" ...
    durationDays: { type: Number, required: true },      // 30, 90, 180, 365
    price:        { type: Number, required: true },
    description:  { type: String, default: '' },
    isActive:     { type: Boolean, default: true }
}, { timestamps: true });

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

module.exports = {
    SubscriptionPlan:       mongoose.model('SubscriptionPlan',       SubscriptionPlanSchema),
    WorkerSubscription:     mongoose.model('WorkerSubscription',     WorkerSubscriptionSchema)
};
