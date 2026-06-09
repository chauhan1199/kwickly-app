const mongoose = require('mongoose');

const AppSettingsSchema = new mongoose.Schema({
    isSingleton: {
        type: String,
        default: 'CONFIG',
        unique: true
    },
    fees: {
        fixedThreshold: { type: Number, default: 500 },
        fixedAmount: { type: Number, default: 50 },
        percentage: { type: Number, default: 10 }
    },
    paymentMethods: {
        qrExpiry: { type: Number, default: 30 },
        cashEnabled: { type: Boolean, default: true }
    },
    wallet: {
        minimumBalance: { type: Number, default: 100 },
        topupPresets: { type: [Number], default: [50, 100, 200, 500] }
    },
    subscriptionPlans: [{
        id: String,
        label: String,
        price: Number,
        durationDays: Number,
        features: [String],
        isActive: Boolean
    }],
    trialDurationDays: { type: Number, default: 90 },
    radius: {
        rounds: [{
            minKm: Number,
            maxKm: Number,
            waitMinutes: Number
        }],
        maxKm: { type: Number, default: 15 }
    },
    otp: {
        validityMinutes: { type: Number, default: 10 },
        maxAttempts: { type: Number, default: 5 },
        resendCooldownSeconds: { type: Number, default: 60 }
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
    disputeCategories: { type: [String], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('AppSettings', AppSettingsSchema);
