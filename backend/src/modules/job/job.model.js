const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }, // Only assigned after quote acceptance
    
    category: { type: String, required: true },
    subcategory: { type: String },
    description: { type: String },
    media: [{ type: String }], // Array of URLs for photos/videos
    preferredDate: { type: Date },
    timeSlot: { type: String, enum: ['urgent', 'morning', 'afternoon', 'evening'] },
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
    
    quotes: [{
        workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
        amount: { type: Number, required: true },
        description: { type: String },
        timeToReach: { type: String },
        status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED'], default: 'PENDING' },
        createdAt: { type: Date, default: Date.now }
    }],
    
    payment: {
        amount: { type: Number },
        platformFee: { type: Number },
        workerPayout: { type: Number },
        status: { type: String, enum: ['PENDING', 'PAID', 'REFUNDED'], default: 'PENDING' },
        razorpayOrderId: { type: String },
        razorpayPaymentId: { type: String }
    },
    
    security: {
        arrivalOtp: { type: String },
        completionOtp: { type: String }
    },
    
    completionDetails: {
        media: [{ type: String }],
        report: { type: String },
        completedAt: { type: Date }
    },
    
    rating: {
        score: { type: Number, min: 1, max: 5 },
        review: { type: String },
        createdAt: { type: Date }
    }
}, { timestamps: true });

JobSchema.index({ status: 1 });
JobSchema.index({ customerId: 1 });
JobSchema.index({ workerId: 1 });
JobSchema.index({ createdAt: -1 });
JobSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Job', JobSchema);
