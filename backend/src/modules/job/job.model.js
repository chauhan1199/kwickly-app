const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    preferredWorkerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },

    category: { type: String, required: true },
    subcategory: { type: String },
    description: { type: String },
    budget: { type: Number },
    media: [{ type: String }],
    preferredDate: { type: Date },
    timeSlot: { type: String, enum: ['urgent', 'morning', 'afternoon', 'evening'] },

    status: {
        type: String,
        enum: ['BROADCASTING', 'QUOTES_RECEIVED', 'ALLOCATED', 'ARRIVING', 'IN_PROGRESS', 'COMPLETED', 'PAID', 'CLOSED', 'CANCELLED', 'DISPUTED'],
        default: 'BROADCASTING'
    },
    cancelReason: { type: String },

    location: {
        type: { type: String, default: 'Point' },
        coordinates: { type: [Number], required: true }
    },
    addressDetails: {
        city: { type: String },
        fullAddress: { type: String }
    },

    broadcast: {
        round: { type: Number, default: 0 },
        lastAttemptAt: { type: Date, default: Date.now },
        radiusKm: { type: Number, default: 0 }
    },

    // NOTE: Quotes are stored in the separate Quote collection (normalized).
    // Embedded quotes array removed to eliminate data duplication.

    payment: {
        amount: { type: Number }, // The total amount paid by customer (workerPayout + platformFee + gst)
        platformFee: { type: Number }, // Admin revenue
        gst: { type: Number }, // GST collected on platform fee
        gstAmount: { type: Number },
        workerPayout: { type: Number }, // Exact amount worker quoted
        quotedAmount: { type: Number },
        status: { type: String, enum: ['PENDING', 'PAID', 'REFUNDED'], default: 'PENDING' },
        escrowStatus: { type: String, enum: ['UNLOCKED', 'LOCKED', 'SETTLED', 'REFUNDED'], default: 'UNLOCKED' },
        method: { type: String, default: 'UPI' },
        razorpayOrderId: { type: String },
        razorpayPaymentId: { type: String }
    },

    security: {
        arrivalOtp: { type: String },
        completionOtp: { type: String }
    },

    startedAt: { type: Date },   // set when the arrival OTP is verified (IN_PROGRESS)

    completionDetails: {
        media: [{ type: String }],
        report: { type: String },
        completedAt: { type: Date }
    },

    rating: {
        score: { type: Number, min: 1, max: 5 },
        review: { type: String },
        createdAt: { type: Date }
    },

    // The worker's rating of the customer (POST /jobs/:id/rate-customer)
    customerRating: {
        score: { type: Number, min: 1, max: 5 },
        review: { type: String },
        createdAt: { type: Date }
    },

    // Dispute tracking (Loophole #9 fix)
    dispute: {
        reportedBy: { type: String, enum: ['WORKER', 'CUSTOMER'] },
        amountReceived: { type: Number },
        shortAmount: { type: Number },
        reason: { type: String },
        reportedAt: { type: Date },
        status: { type: String, enum: ['OPEN', 'RESOLVED'], default: 'OPEN' },
        resolution: { type: String, enum: ['DEDUCT_FROM_WORKER', 'WAIVE_FEE', 'REFUND_CUSTOMER', 'CLOSE'] },
        adminNote: { type: String },
        resolvedAt: { type: Date }
    },
    disputeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispute' }
}, { timestamps: true });

// ─── Indexes ──────────────────────────────────────────────────────────────────
JobSchema.index({ location: '2dsphere' });
JobSchema.index({ customerId: 1, createdAt: -1 });
JobSchema.index({ workerId: 1, createdAt: -1 });
JobSchema.index({ status: 1, createdAt: -1 });          // Admin filter + broadcasting
JobSchema.index({ 'payment.status': 1 });               // Revenue aggregation
JobSchema.index({ status: 1, 'broadcast.lastAttemptAt': 1 }); // Cron broadcast sweep
JobSchema.index({ status: 1, updatedAt: 1 });           // Cron ghost-quote sweep

module.exports = mongoose.model('Job', JobSchema);
