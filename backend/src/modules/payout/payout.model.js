const mongoose = require('mongoose');

const PayoutSchema = new mongoose.Schema({
    workerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer'
    },
    shopId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shop'
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'TRANSFERRED', 'REJECTED'],
        default: 'PENDING'
    },
    paymentMethod: {
        type: String,
        enum: ['UPI', 'BANK'],
        required: true
    },
    paymentDetails: {
        type: String, // UPI ID or Bank Account Details
        required: true
    },
    txnId: {
        type: String
    },
    walletTxnId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WalletTxn'
    },
    rejectReason: {
        type: String
    },
    requestedAt: {
        type: Date,
        default: Date.now
    },
    processedAt: {
        type: Date
    }
}, {
    timestamps: true,
    validate: {
        validator: function () {
            return this.workerId || this.shopId;
        },
        message: 'At least one of workerId or shopId must be present.'
    }
});

PayoutSchema.index({ status: 1 });
PayoutSchema.index({ workerId: 1 });
PayoutSchema.index({ shopId: 1 });

module.exports = mongoose.model('Payout', PayoutSchema);
