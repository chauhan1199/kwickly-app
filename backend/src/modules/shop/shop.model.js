const mongoose = require('mongoose');
const logger = require('../../helpers/logger.helper');

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

    deliveryConfig: {
        deliveryRadiusKm: { type: Number, default: 3 },
        minOrderAmount: { type: Number, default: 100 },
        freeDeliveryAbove: { type: Number, default: 1000 },
        deliveryCharge: { type: Number, default: 40 },
        discountEnabled: { type: Boolean, default: false },
        discountAbove: { type: Number, default: 1000 },
        discountType: { type: String, enum: ['flat', 'percent'], default: 'flat' },
        discountValue: { type: Number, default: 100 },
        discountPct: { type: Number, default: 10 },
        maxDiscountCap: { type: Number, default: 200 },
        sameDayDelivery: { type: Boolean, default: true },
        deliverySlots: [{ label: String, slotOpen: String, slotClose: String }]
    },

    kyc: {
        status:    { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
        documents: [{ name: String, url: String, public_id: String, docType: { type: String, default: 'OTHER' } }]
    },

    payoutMethods: [PayoutMethodSchema],

    wallet: {
        balance: { type: Number, default: 0 }
    },

    isOnline: { type: Boolean, default: true },
    rating:   { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    subscription: {
        status: { type: String, enum: ['ACTIVE', 'EXPIRED', 'TRIAL', 'NONE'], default: 'NONE' },
        planId: { type: String },
        expiryDate: { type: Date },
        isTrial: { type: Boolean, default: true }
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date }
}, { timestamps: true });

ShopSchema.index({ location: '2dsphere' });
ShopSchema.index({ 'kyc.status': 1 });
ShopSchema.index({ isDeleted: 1 });

const clearCache = async function (doc, next) {
    const { delCacheByPattern } = require('../../helpers/redis.helper');
    try {
        await delCacheByPattern('*shops_list*');
    } catch (e) {
        logger.error('Cache clear error:', e);
    }
    if (typeof next === 'function') next();
};

ShopSchema.post('save', clearCache);
ShopSchema.post('findOneAndUpdate', clearCache);
ShopSchema.post('findOneAndDelete', clearCache);
ShopSchema.post('updateOne', clearCache);
ShopSchema.post('deleteMany', clearCache);

module.exports = mongoose.model('Shop', ShopSchema);
