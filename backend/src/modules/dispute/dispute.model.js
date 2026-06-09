const mongoose = require('mongoose');

const DisputeSchema = new mongoose.Schema({
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job'
    },
    shopOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ShopOrder'
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    workerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer'
    },
    reason: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['open', 'in_review', 'resolved', 'refunded'],
        default: 'open'
    },
    resolutionNotes: { type: String },
    openedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date }
}, { timestamps: true });

DisputeSchema.index({ jobId: 1, status: 1 });
DisputeSchema.index({ customerId: 1 });
DisputeSchema.index({ workerId: 1 });

module.exports = mongoose.model('Dispute', DisputeSchema);
