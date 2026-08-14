const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
    role: { type: String, enum: ['CUSTOMER', 'WORKER', 'ADMIN', 'SHOP'], required: true },
    phone: { type: String, required: true },
    email: { type: String, sparse: true, lowercase: true, trim: true },
    password: { type: String },
    isVerified: { type: Boolean, default: false },
    name: { type: String },
    profileImage: { type: String },
    
    // Worker specific fields
    wallet: {
        balance: { type: Number, default: 0 },
        bankDetails: {
            accountNumber: { type: String },
            ifscCode: { type: String },
            bankName: { type: String }
        },
        upiId: { type: String }
    },
    kyc: {
        status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
        rejectReason: { type: String },
        documents: [{
            type: { type: String, enum: ['AADHAR', 'PAN', 'LICENSE', 'OTHER'] },
            url: { type: String },
            public_id: { type: String },
            uploadedAt: { type: Date, default: Date.now }
        }]
    },
    subscription: {
        planId:       { type: String },
        expiryDate:   { type: Date },
        isTrial:      { type: Boolean, default: true },
        trialEndDate: { type: Date }   // ← registration date + trialDurationDays
    },
    activeLocation: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number] }, // [longitude, latitude]
        addressDetails: {
            city: { type: String },
            pincode: { type: String },
            area: { type: String }
        }
    },
    addresses: {
        type: [{
            isPrimary: { type: Boolean, default: false },
            label: { type: String }, // e.g. Home, Office, Default
            street: { type: String },
            city: { type: String },
            area: { type: String },
            pincode: { type: String },
            location: {
                type: { type: String, enum: ['Point'] },
                coordinates: { type: [Number] } // [lng, lat]
            }
        }],
        validate: [arr => arr.length <= 10, 'Maximum 10 addresses']
    },
    serviceRadius: { type: Number, default: 10 }, // in km
    services: {
        type: [{
            category:     { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
            categoryName: { type: String },  // ← denormalized name for fast category filtering
            subcategories: [{ type: String }],
            isActive:     { type: Boolean, default: true }
        }],
        validate: [arr => arr.length <= 20, 'Maximum 20 services']
    },
    isOnline: { type: Boolean, default: false },
    city: { type: String },
    bio: { type: String },
    fcmToken: { type: String, select: false },
    rating: {
        average: { type: Number, default: 0 },
        count: { type: Number, default: 0 }
    },
    notificationPreferences: {
        jobUpdates: { type: Boolean, default: true },
        promotions: { type: Boolean, default: true }
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date }
}, { timestamps: true });

CustomerSchema.index({ role: 1 });
CustomerSchema.index({ 'kyc.status': 1 });
CustomerSchema.index({ isVerified: 1 });
CustomerSchema.index({ activeLocation: '2dsphere' });
CustomerSchema.index({ phone: 1, role: 1 }, { unique: true });
CustomerSchema.index({ email: 1, role: 1 }, { unique: true, partialFilterExpression: { email: { $exists: true, $type: "string" } } });
// Performance indexes for worker availability queries
CustomerSchema.index({ role: 1, isOnline: 1, 'kyc.status': 1, isVerified: 1 });
CustomerSchema.index({ 'subscription.expiryDate': 1 });
CustomerSchema.index({ city: 1, role: 1 });
CustomerSchema.index({ role: 1, isOnline: 1, city: 1 });

CustomerSchema.index({ 'services.category': 1, role: 1, isOnline: 1, activeLocation: '2dsphere' });
CustomerSchema.index({ isDeleted: 1 });
CustomerSchema.index({ role: 1, isVerified: 1, isOnline: 1, 'kyc.status': 1, 'wallet.balance': 1, activeLocation: '2dsphere' });

module.exports = mongoose.model('Customer', CustomerSchema);
