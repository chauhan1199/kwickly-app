const mongoose = require('mongoose');

const AppSettingsSchema = new mongoose.Schema({
    isSingleton: {
        type: String,
        default: 'CONFIG',
        unique: true
    },
    fees: {
        type: { type: String, enum: ['flat', 'percent'], default: 'flat' },
        amount: { type: Number, default: 50 },
        gstPercentage: { type: Number, default: 18 }
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
    disputeCategories: { type: [String], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('AppSettings', AppSettingsSchema);
