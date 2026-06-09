const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' }, // Null if chat is with Admin
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }, // Null if receiver is Admin/System
    text: { type: String, required: true },
    mediaUrl: { type: String },
    isRead: { type: Boolean, default: false }
}, { timestamps: true });

MessageSchema.index({ jobId: 1 });
MessageSchema.index({ senderId: 1, receiverId: 1 });
MessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
