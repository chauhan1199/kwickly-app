const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name:      { type: String, required: true },
    price:     { type: Number, required: true },
    qty:       { type: Number, required: true, min: 1 },
    imageUrl:  { type: String }
}, { _id: false });

const ShopOrderSchema = new mongoose.Schema({
    orderNumber: { type: String, unique: true },
    shopId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Shop',     required: true },
    customerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },

    items:       [OrderItemSchema],

    subtotal:    { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    discount:    { type: Number, default: 0 },
    total:       { type: Number, required: true },

    deliveryAddress: { type: String },
    deliveryLocation: {
        type:        { type: String, default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
    },
    deliverySlot: { type: mongoose.Schema.Types.Mixed },

    status: {
        type:    String,
        enum:    ['NEW', 'CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
        default: 'NEW'
    },

    deliveryOtp: { type: String },
    deliveryStaffName: { type: String },
    deliveryStaffPhone: { type: String },

    statusHistory: [{
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String
    }],

    payment: {
        amount:            { type: Number },
        method:            { type: String, enum: ['WALLET', 'UPI', 'CASH'], default: 'WALLET' },
        status:            { type: String, enum: ['PENDING', 'PAID', 'REFUNDED'], default: 'PENDING' },
        razorpayOrderId:   { type: String },
        razorpayPaymentId: { type: String }
    },

    promoCode: { type: String },
    promoDiscount: { type: Number, default: 0 },

    invoiceUrl: { type: String },
    shopNote:   { type: String }
}, { timestamps: true });

ShopOrderSchema.index({ shopId: 1, status: 1, createdAt: -1 }); // Shop dashboard filter
ShopOrderSchema.index({ customerId: 1, createdAt: -1 });        // Customer order history
ShopOrderSchema.index({ createdAt: -1 });                       // Admin list sort
ShopOrderSchema.index({ status: 1, createdAt: -1 });            // Status-based filtering

module.exports = mongoose.model('ShopOrder', ShopOrderSchema);
