const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
    role: { type: String, enum: ['CUSTOMER', 'WORKER', 'ADMIN', 'SHOP'], required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, unique: true, sparse: true },
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
    rating: {
        average: { type: Number, default: 0 },
        count: { type: Number, default: 0 }
    }
}, { timestamps: true });

CustomerSchema.index({ role: 1 });
CustomerSchema.index({ 'kyc.status': 1 });
CustomerSchema.index({ isVerified: 1 });
CustomerSchema.index({ activeLocation: '2dsphere' });

module.exports = mongoose.model('Customer', CustomerSchema);
