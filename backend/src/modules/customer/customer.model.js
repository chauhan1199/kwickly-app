const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
    role: { type: String, enum: ['CUSTOMER', 'WORKER', 'ADMIN', 'SHOP'], required: true },
    phone: { type: String, required: true },
    email: { type: String, sparse: true },
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
        documents: [{
            type: { type: String, enum: ['AADHAR', 'PAN', 'LICENSE', 'OTHER'] },
            url: { type: String },
            uploadedAt: { type: Date, default: Date.now }
        }]
    },
    subscription: {
        planId: { type: String },
        expiryDate: { type: Date },
        isTrial: { type: Boolean, default: true }
    },
    activeLocation: {
        type: { type: String, default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }, // [longitude, latitude]
        addressDetails: {
            city: { type: String },
            pincode: { type: String },
            area: { type: String }
        }
    },
    addresses: [{
        isPrimary: { type: Boolean, default: false },
        label: { type: String }, // e.g. Home, Office, Default
        street: { type: String },
        city: { type: String },
        area: { type: String },
        pincode: { type: String },
        location: {
            type: { type: String, default: 'Point' },
            coordinates: { type: [Number], default: [0, 0] } // [lng, lat]
        }
    }],
    serviceRadius: { type: Number, default: 10 }, // in km
    services: [{
        category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
        subcategories: [{ type: String }],
        isActive: { type: Boolean, default: true }
    }],
    isOnline: { type: Boolean, default: false },
    city: { type: String },
    bio: { type: String },
    rating: {
        average: { type: Number, default: 0 },
        count: { type: Number, default: 0 }
    },
    notificationPreferences: {
        jobUpdates: { type: Boolean, default: true },
        promotions: { type: Boolean, default: true }
    }
}, { timestamps: true });

CustomerSchema.index({ role: 1 });
CustomerSchema.index({ 'kyc.status': 1 });
CustomerSchema.index({ isVerified: 1 });
CustomerSchema.index({ activeLocation: '2dsphere' });
CustomerSchema.index({ phone: 1, role: 1 }, { unique: true });
CustomerSchema.index({ email: 1, role: 1 }, { unique: true, partialFilterExpression: { email: { $exists: true, $type: "string" } } });
CustomerSchema.index({ city: 1 });
CustomerSchema.index({ role: 1, isOnline: 1, city: 1 });

module.exports = mongoose.model('Customer', CustomerSchema);
