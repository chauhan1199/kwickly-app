const mongoose = require('mongoose');

const AdminWalletSchema = new mongoose.Schema({
    balance: { type: Number, default: 0, min: 0 },
    // Revenue bookkeeping (treasury) — fee income vs GST collected on behalf of the government
    totalCommission: { type: Number, default: 0 },
    platformFeeRevenue: { type: Number, default: 0 },
    subscriptionRevenue: { type: Number, default: 0 },
    gstLiability: { type: Number, default: 0 },
    bankDetails: {
        accountHolder: { type: String },
        accountNumber: { type: String },
        ifscCode: { type: String },
        bankName: { type: String }
    },
    upiId: { type: String }
}, { timestamps: true });

const AdminWalletTxnSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: [
            'PLATFORM_FEE_COLLECTED',
            'COMMISSION_COLLECTED',
            'SETTLEMENT_CREDIT',
            'MANUAL_CREDIT',
            'MANUAL_DEBIT',
            'PAYOUT_DEBIT',
            'WORKER_PAYOUT',
            'SHOP_PAYOUT',
            'WITHDRAWAL',
            'REFUND_DEBIT',
            'FEE_REVERSAL',
            'TOPUP'
        ],
        required: true
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    description: { type: String },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    referenceModel: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

AdminWalletTxnSchema.index({ type: 1 });
AdminWalletTxnSchema.index({ createdAt: -1 });

const AdminWallet = mongoose.model('AdminWallet', AdminWalletSchema);
const AdminWalletTxn = mongoose.model('AdminWalletTxn', AdminWalletTxnSchema);

AdminWalletTxnSchema.index({ referenceId: 1 });

module.exports = { AdminWallet, AdminWalletTxn };
