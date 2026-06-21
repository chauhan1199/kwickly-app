const mongoose = require('mongoose');

const DeliveryStaffSchema = new mongoose.Schema({
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name: { type: String, required: true },
    phone: { type: String },
    activeOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopOrder' },
    totalDeliveries: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 }
}, { timestamps: true });

DeliveryStaffSchema.index({ shopId: 1 });

module.exports = mongoose.model('DeliveryStaff', DeliveryStaffSchema);
