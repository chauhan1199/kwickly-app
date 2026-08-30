const mongoose = require('mongoose');

const PlatformLedgerSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    settlementId: {
        type: String,
        index: true
    },
    idempotencyKey: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },
    entityType: {
        type: String,
        enum: [
            'SERVICE_JOB',
            'SHOP_ORDER',
            'WORKER_SUBSCRIPTION',
            'SHOP_SUBSCRIPTION',
            'CUSTOMER_WALLET_TOPUP',
            'WORKER_PAYOUT',
            'SHOP_SETTLEMENT',
            'CUSTOMER_REFUND',
            'DISPUTE_ADJUSTMENT'
        ],
        required: true,
        index: true
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    referenceNumber: {
        type: String // Order Number or Job Code
    },
    
    // Financial Breakdown (All values in INR)
    grossAmount: { type: Number, required: true },       // Total paid by customer / subscriber
    partnerAmount: { type: Number, default: 0 },         // 100% Worker Quote or 100% Net Shop Sales
    platformFee: { type: Number, default: 0 },           // Kwickly SaaS / Marketplace Revenue
    gstAmount: { type: Number, default: 0 },             // GST Liability collected
    deliveryFee: { type: Number, default: 0 },           // Delivery Rider Earnings
    refundAmount: { type: Number, default: 0 },

    // Commission Rates Applied
    partnerCommissionPercent: { type: Number, default: 0 }, // 0% as per specification

    // Accounts Involved
    fromAccount: {
        accountType: { type: String, enum: ['CUSTOMER_WALLET', 'CUSTOMER_DIRECT_UPI', 'ESCROW', 'WORKER_WALLET', 'SHOP_WALLET', 'KWICKLY_TREASURY'] },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
        shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' }
    },
    toAccount: {
        accountType: { type: String, enum: ['ESCROW', 'WORKER_WALLET', 'SHOP_WALLET', 'RIDER_WALLET', 'KWICKLY_TREASURY', 'GST_TAX_LEDGER', 'CUSTOMER_WALLET', 'BANK_ACCOUNT'] },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
        shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' }
    },

    // Payment & Settlement State
    paymentMethod: { type: String, enum: ['UPI', 'WALLET', 'COD', 'CASH', 'BANK_TRANSFER'], default: 'UPI' },
    paymentStatus: { type: String, enum: ['PENDING', 'PENDING_VERIFICATION', 'PAID', 'FAILED', 'REFUNDED'], default: 'PAID' },
    settlementStatus: { type: String, enum: ['UNSETTLED', 'ESCROW_LOCKED', 'SETTLED', 'REFUNDED', 'DISPUTED', 'REVERSED'], default: 'SETTLED' },

    utrNumber: { type: String },
    bankReference: { type: String },

    // Configuration snapshot used for calculations
    configSnapshot: {
        mode: String,
        threshold: Number,
        minFee: Number,
        percentage: Number,
        gstPercent: Number,
        appliedAt: { type: Date, default: Date.now }
    },

    description: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

PlatformLedgerSchema.index({ entityType: 1, createdAt: -1 });
PlatformLedgerSchema.index({ settlementStatus: 1 });
PlatformLedgerSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PlatformLedger', PlatformLedgerSchema);
