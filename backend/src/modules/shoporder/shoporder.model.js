const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name:      { type: String, required: true },
    price:     { type: Number, required: true },
    qty:       { type: Number, required: true, min: 1 },
    imageUrl:  { type: String }
}, { _id: false });

const ShopOrderSchema = new mongoose.Schema({
    shopId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Shop',     required: true },
    customerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },

    items:       [OrderItemSchema],

    subtotal:    { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    total:       { type: Number, required: true },

    deliveryAddress: { type: String },
    deliveryLocation: {
        type:        { type: String, default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
    },

    status: {
        type:    String,
        enum:    ['NEW', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
        default: 'NEW'
    },

    deliveryOtp: { type: String },   // 4-digit OTP for delivery handoff

    payment: {
        amount:            { type: Number },
        status:            { type: String, enum: ['PENDING', 'PAID', 'REFUNDED'], default: 'PENDING' },
        razorpayOrderId:   { type: String },
        razorpayPaymentId: { type: String }
    },

    invoiceUrl: { type: String }
}, { timestamps: true });

ShopOrderSchema.index({ shopId: 1, status: 1 });
ShopOrderSchema.index({ customerId: 1 });
ShopOrderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ShopOrder', ShopOrderSchema);
