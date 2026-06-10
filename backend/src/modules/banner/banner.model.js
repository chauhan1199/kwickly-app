const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Banner title is required'],
        trim: true
    },
    imageUrl: {
        type: String,
        required: [true, 'Banner image URL is required']
    },
    targetAudience: {
        type: String,
        enum: ['CUSTOMER', 'WORKER', 'SHOP', 'ALL'],
        default: 'ALL'
    },
    startDate: {
        type: Date,
        required: [true, 'Start date is required']
    },
    endDate: {
        type: Date,
        required: [true, 'End date is required']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    link: {
        type: String,
        default: ''
    }
}, { timestamps: true });

module.exports = mongoose.model('Banner', bannerSchema);
