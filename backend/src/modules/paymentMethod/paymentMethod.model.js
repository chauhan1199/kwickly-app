const mongoose = require('mongoose');

const BankAccountSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    accountHolder: { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifscCode: { type: String, required: true },
    bankName: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false }
}, { timestamps: true });

BankAccountSchema.index({ userId: 1 });

const UpiAccountSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    upiId: { type: String, required: true },
    name: { type: String, required: true },
    isDefault: { type: Boolean, default: false }
}, { timestamps: true });

UpiAccountSchema.index({ userId: 1 });

module.exports = {
    BankAccount: mongoose.model('BankAccount', BankAccountSchema),
    UpiAccount: mongoose.model('UpiAccount', UpiAccountSchema)
};
