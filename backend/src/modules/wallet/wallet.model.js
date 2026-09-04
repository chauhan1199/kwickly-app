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
            'ORDER_PAYMENT',     // customer paying for an order
            'JOB_PAYMENT',       // customer paying for a job
            'TRANSFER_SENT',     // P2P wallet transfer sent
            'TRANSFER_RECEIVED'  // P2P wallet transfer received
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

    refId:       { type: String },    // jobId / orderId / subscriptionId
    planId:      { type: String },    // subscription plan being purchased
    description: { type: String },
    invoiceUrl:  { type: String },

    // ── Automated UPI webhook fields ─────────────────────────────────
    gatewayTransactionId: { type: String }, // provider's txn ID from webhook
    webhookEventId:       { type: String }, // idempotency key (unique sparse index below)
    verifiedAt:           { type: Date },   // when webhook confirmed the payment

    // Legacy field — kept for backward-compat with in-flight manual-UTR records
    razorpayPaymentId: { type: String },    // stored the manually-entered UTR; now read-only

    // P2P Wallet Transfer fields
    counterpartyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    counterpartyName: { type: String }
}, { timestamps: true });

WalletTxnSchema.index({ userId: 1, createdAt: -1 });     // User transaction history
WalletTxnSchema.index({ userId: 1, type: 1 });           // Filter by user+type
WalletTxnSchema.index({ type: 1, createdAt: -1 });       // Admin ledger filter
WalletTxnSchema.index({ status: 1 });                    // Pending/failed lookup
WalletTxnSchema.index({ refId: 1 });

// Automated webhook idempotency — prevents the same provider event from
// crediting the wallet more than once.
WalletTxnSchema.index(
    { webhookEventId: 1 },
    { unique: true, sparse: true }
);

// Legacy dedup index for manually-submitted UTRs (kept until all PENDING records
// are resolved; can be dropped once the UTR flow is fully retired).
WalletTxnSchema.index(
    { type: 1, razorpayPaymentId: 1 },
    { unique: true, sparse: true, partialFilterExpression: { type: 'TOPUP', razorpayPaymentId: { $type: 'string' } } }
);

module.exports = mongoose.model('WalletTxn', WalletTxnSchema);
