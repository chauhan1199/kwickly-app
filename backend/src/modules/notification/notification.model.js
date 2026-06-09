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
        enum: ['BROADCAST', 'DIRECT', 'SYSTEM'],
        default: 'BROADCAST'
    },
    targetRole: {
        type: String,
        enum: ['ALL', 'WORKER', 'CUSTOMER', 'SHOP', 'ADMIN'],
        default: 'ALL'
    },
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);
