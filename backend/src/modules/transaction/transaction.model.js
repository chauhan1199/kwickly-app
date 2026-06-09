const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    workerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    type: {
        type: String,
        enum: ['earning', 'payout', 'subscription', 'refund'],
        required: true
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job'
    },
    payoutId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payout'
    },
    amount: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'completed'
    },
    txnDate: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

TransactionSchema.index({ workerId: 1, type: 1 });
TransactionSchema.index({ txnDate: -1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
