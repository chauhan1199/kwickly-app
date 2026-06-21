const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    workerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },

    category:    { type: String, required: true },
    subcategory: { type: String },
    description: { type: String },
    media:       [{ type: String }],
    preferredDate: { type: Date },
    timeSlot:    { type: String, enum: ['urgent', 'morning', 'afternoon', 'evening'] },

    status: {
        type: String,
        enum: ['BROADCASTING', 'QUOTES_RECEIVED', 'ALLOCATED', 'ARRIVING', 'IN_PROGRESS', 'COMPLETED', 'PAID', 'CLOSED', 'CANCELLED'],
        default: 'BROADCASTING'
    },

    location: {
        type: { type: String, default: 'Point' },
        coordinates: { type: [Number], required: true }
    },
    addressDetails: { type: String },

    // NOTE: Quotes are stored in the separate Quote collection (normalized).
    // Embedded quotes array removed to eliminate data duplication.

    payment: {
        amount:           { type: Number },
        platformFee:      { type: Number },
        workerPayout:     { type: Number },
        status:           { type: String, enum: ['PENDING', 'PAID', 'REFUNDED'], default: 'PENDING' },
        razorpayOrderId:  { type: String },
        razorpayPaymentId:{ type: String }
    },

    security: {
        arrivalOtp:    { type: String },
        completionOtp: { type: String }
    },

    completionDetails: {
        media:       [{ type: String }],
        report:      { type: String },
        completedAt: { type: Date }
    },

    rating: {
        score:     { type: Number, min: 1, max: 5 },
        review:    { type: String },
        createdAt: { type: Date }
    }
}, { timestamps: true });

// ─── Indexes ──────────────────────────────────────────────────────────────────
JobSchema.index({ location: '2dsphere' });
JobSchema.index({ customerId: 1, createdAt: -1 });
JobSchema.index({ workerId: 1, createdAt: -1 });
JobSchema.index({ status: 1, createdAt: -1 });          // Admin filter + broadcasting
JobSchema.index({ 'payment.status': 1 });               // Revenue aggregation

module.exports = mongoose.model('Job', JobSchema);
