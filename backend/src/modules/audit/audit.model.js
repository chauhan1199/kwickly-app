const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    actorRole: { type: String, enum: ['CUSTOMER', 'WORKER', 'ADMIN', 'SHOP'] },
    action: { type: String, required: true },
    targetType: { type: String },
    targetId: { type: String },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
    requestId: { type: String }
}, { timestamps: true });

AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ targetType: 1, targetId: 1 });
AuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
