const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // If null, it's a broadcast
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['BROADCAST', 'DIRECT', 'SYSTEM', 'ADMIN_ACTIVITY'],
        default: 'BROADCAST'
    },
    action: {
        type: String,
        enum: ['CREATE', 'UPDATE', 'DELETE', 'TOGGLE_STATUS', 'KYC', 'PAYOUT', 'WALLET_CREDIT', 'WALLET_DEBIT', 'IMPERSONATE', 'SETTLE', 'BROADCAST', 'SYSTEM', 'OTHER'],
        default: 'OTHER'
    },
    entityType: {
        type: String,
        enum: ['CUSTOMER', 'WORKER', 'SHOP', 'JOB', 'ORDER', 'PAYOUT', 'WALLET', 'KYC', 'CATEGORY', 'PROMOTION', 'PRODUCT', 'SETTINGS', 'BANNER', 'PROMO', 'DISPUTE', 'OTHER']
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    targetRole: {
        type: String,
        enum: ['ALL', 'ADMIN', 'CUSTOMER', 'WORKER', 'SHOP'],
        default: 'ALL'
    },
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, { timestamps: true });

NotificationSchema.index({ type: 1, targetRole: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, action: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
