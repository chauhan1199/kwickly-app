const mongoose = require('mongoose');

const SettlementSchema = new mongoose.Schema({
    type: { type: String, enum: ['SERVICE_JOB', 'PRODUCT_ORDER'], required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopOrder' },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    totalAmount: { type: Number, required: true },
    platformCommission: { type: Number, required: true },
    shopEarning: { type: Number, required: true },
    status: { type: String, enum: ['PENDING', 'SETTLED', 'CANCELLED'], default: 'PENDING' },
    settledAt: { type: Date },
    settledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', immutable: true },
    note: { type: String }
}, { timestamps: true });

SettlementSchema.index({ status: 1 });
SettlementSchema.index({ shopId: 1 });
SettlementSchema.index({ type: 1 });

module.exports = mongoose.model('Settlement', SettlementSchema);
