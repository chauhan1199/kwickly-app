const mongoose = require('mongoose');

const AppSettingsSchema = new mongoose.Schema({
    isSingleton: {
        type: String,
        default: 'CONFIG',
        unique: true
    },
    fees: {
        type: { type: String, enum: ['flat', 'percent', 'percentage', 'tiered', 'TIERED'], default: 'tiered' },
        amount: { type: Number, default: 50 },
        minFee: { type: Number, default: 50 },
        threshold: { type: Number, default: 500 },
        percentage: { type: Number, default: 12 },
        percentAboveThreshold: { type: Number, default: 12 },
        gstPercentage: { type: Number, default: 18 },
        workerCommissionPercent: { type: Number, default: 0 }, // 0% Partner Commission
        shopCommissionPercent: { type: Number, default: 0 }     // 0% Partner Commission
    },
    serviceJobFee: {
        mode: { type: String, enum: ['TIERED', 'PERCENTAGE', 'FIXED'], default: 'TIERED' },
        threshold: { type: Number, default: 500 },
        minFee: { type: Number, default: 50 },
        percentAboveThreshold: { type: Number, default: 12 },
        percentage: { type: Number, default: 12 },
        fixedFee: { type: Number, default: 50 },
        gstPercent: { type: Number, default: 18 },
        feePaidBy: { type: String, default: 'CUSTOMER' },
        workerCommissionPercent: { type: Number, default: 0 }
    },
    shopOrderFee: {
        mode: { type: String, enum: ['PERCENTAGE', 'FIXED'], default: 'PERCENTAGE' },
        percentage: { type: Number, default: 5 },
        minFee: { type: Number, default: 10 },
        fixedFee: { type: Number, default: 10 },
        gstPercent: { type: Number, default: 18 },
        feePaidBy: { type: String, default: 'CUSTOMER' },
        shopCommissionPercent: { type: Number, default: 0 }
    },
    wallet: {
        minimumBalance: { type: Number, default: 100 },
        topupPresets: { type: [Number], default: [50, 100, 200, 500] }
    },
    subscription: {
        freeTrialDays: { type: Number, default: 14 }
    },
    subscriptionPlans: [{
        id: String,
        label: String,
        price: Number,
        gstPercent: { type: Number, default: 18 },
        durationDays: Number,
        features: [String],
        isActive: Boolean,
        targetRole: { type: String, enum: ['WORKER', 'SHOP'], default: 'WORKER' }
    }],
    radius: {
        maxKm: { type: Number, default: 15 }
    },
    maintenance: {
        mode: { type: Boolean, default: false },
        message: { type: String, default: 'We are currently under maintenance. Please try again later.' }
    },
    branding: {
        appName: { type: String, default: 'Kwickly' },
        logoUrl: { type: String, default: '' },
        iconUrl: { type: String, default: '' }
    },
    disputeCategories: { type: [String], default: [] },
    legal: {
        termsOfService: { type: String, default: '' },
        privacyPolicy: { type: String, default: '' }
    },
    faqs: [{
        question: { type: String, required: true },
        answer: { type: String, required: true },
        targetRole: { type: String, enum: ['ALL', 'CUSTOMER', 'WORKER', 'SHOP'], default: 'ALL' },
        order: { type: Number, default: 0 }
    }],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }
}, { timestamps: true });

module.exports = mongoose.model('AppSettings', AppSettingsSchema);
