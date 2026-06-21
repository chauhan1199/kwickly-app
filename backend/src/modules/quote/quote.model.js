const mongoose = require('mongoose');

const QuoteSchema = new mongoose.Schema({
    jobId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Job',      required: true },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },

    amount:  { type: Number, required: true },
    description:    { type: String, default: '' },
    timeToReach: { type: String },  // estimated arrival time (e.g. "25 mins")

    workerLocation: {
        type:        { type: String, default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }  // [lng, lat]
    },

    status: {
        type:    String,
        enum:    ['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
        default: 'PENDING'
    }
}, { timestamps: true });

QuoteSchema.index({ jobId: 1, status: 1 });              // getQuotesForJob filter
QuoteSchema.index({ workerId: 1, status: 1 });           // getWorkerQuotes filter
QuoteSchema.index({ jobId: 1, workerId: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['PENDING', 'ACCEPTED'] } } }); // prevent duplicate quotes

module.exports = mongoose.model('Quote', QuoteSchema);
