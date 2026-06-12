const mongoose = require('mongoose');

const PayoutMethodSchema = new mongoose.Schema({
    type:      { type: String, enum: ['BANK', 'UPI'], required: true },
    label:     { type: String },                     // "SBI Savings", "GPay"
    detail:    { type: String, required: true },     // account no / UPI ID
    isPrimary: { type: Boolean, default: false }
}, { _id: true });

const ShopSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true },

    name:        { type: String, required: true },
    category:    { type: String, default: 'General' },
    description: { type: String, default: '' },
    logoUrl:     { type: String },

    subscription: {
        plan:       { type: String, enum: ['FREE_TRIAL', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'], default: 'FREE_TRIAL' },
        validUntil: { type: Date }
    },

    address: { type: String },
    location: {
        type:        { type: String, default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
    },

    businessHours: {
        monFri: { type: String, default: '9 AM - 10 PM' },
        sat:    { type: String, default: '9 AM - 10 PM' },
        sun:    { type: String, default: '9 AM - 10 PM' }
    },

    delivery: {
        radiusKm:         { type: Number, default: 3 },
        fee:              { type: Number, default: 40 },
        freeAbove:        { type: Number, default: 1000 }
    },

    kyc: {
        status:    { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
        documents: [{ name: String, url: String, type: String }]
    },

    payoutMethods: [PayoutMethodSchema],

    wallet: {
        balance: { type: Number, default: 0 }
    },

    isOnline: { type: Boolean, default: true },
    rating:   { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 }
}, { timestamps: true });

ShopSchema.index({ location: '2dsphere' });
ShopSchema.index({ 'kyc.status': 1 });

module.exports = mongoose.model('Shop', ShopSchema);
