const mongoose = require('mongoose');

const WalletTxnSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },

    type: {
        type: String,
        enum: [
            'JOB_CREDIT',        // worker earns from a job
            'JOB_DEBIT',         // commission deducted
            'SUBSCRIPTION',      // plan purchase
            'WITHDRAWAL',        // payout to bank/UPI
            'REFUND',            // customer/shop refund
            'ORDER_CREDIT',      // shop earns from order
            'ORDER_DEBIT',       // platform commission from shop
            'REFERRAL_BONUS',    // referral reward
            'ADJUSTMENT',        // admin manual adjustment
            'TOPUP',             // wallet top-up via payment gateway
            'ORDER_PAYMENT'      // customer paying for an order
        ],
        required: true
    },

    amount:  { type: Number, required: true },   // always positive; credit/debit determined by type
    balance: { type: Number, required: true },   // wallet balance after this txn

    status: {
        type: String,
        enum: ['PENDING', 'COMPLETED', 'FAILED'],
        default: 'COMPLETED'
    },

    refId:      { type: String },    // jobId / orderId / subscriptionId
    description:{ type: String },
    invoiceUrl: { type: String }
}, { timestamps: true });

WalletTxnSchema.index({ userId: 1, createdAt: -1 });
WalletTxnSchema.index({ type: 1 });

module.exports = mongoose.model('WalletTxn', WalletTxnSchema);
