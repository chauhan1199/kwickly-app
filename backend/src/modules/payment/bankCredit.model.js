'use strict';

const mongoose = require('mongoose');

const BankCreditSchema = new mongoose.Schema({
    utr: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    amount: {
        type: Number,
        required: true
    },
    sender: {
        type: String,
        trim: true
    },
    rawMessage: {
        type: String
    },
    isClaimed: {
        type: Boolean,
        default: false,
        index: true
    },
    claimedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer'
    },
    claimedAt: {
        type: Date
    },
    source: {
        type: String,
        default: 'BANK_SMS', // 'BANK_SMS' | 'WEBHOOK' | 'MANUAL_DEPOSIT'
    },
    receivedAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('BankCredit', BankCreditSchema);
