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

    items:       { type: [OrderItemSchema], validate: [arr => arr.length <= 50, 'Maximum 50 items'] },

    subtotal:    { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    discount:        { type: Number, default: 0 },
    promoDiscount:   { type: Number, default: 0 },
    netProductSales: { type: Number },
    platformFee:     { type: Number, default: 0 },
    gstAmount:       { type: Number, default: 0 },
    total:           { type: Number, required: true },

    deliveryAddress: { type: String },
    deliveryLocation: {
        type:        { type: String, default: 'Point' },
        coordinates: { type: [Number], default: null }
    },
    deliverySlot: {
        time:  String,
        date:  String,
        notes: String
    },

    status: {
        type:    String,
        enum:    ['NEW', 'CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
        default: 'NEW'
    },

    deliveryOtp: { type: String },
    deliveryOtpGeneratedAt: { type: Date },
    deliveryOtpAttempts: { type: Number, default: 0 },
    deliveryStaffId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryStaff' },
    deliveryStaffName: { type: String },
    deliveryStaffPhone: { type: String },

    statusHistory: [{
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String
    }],

    payment: {
        amount:            { type: Number },
        method:            { type: String, enum: ['WALLET', 'UPI', 'CASH', 'COD'], default: 'WALLET' },
        status:            { type: String, enum: ['PENDING', 'PENDING_VERIFICATION', 'PAID', 'FAILED', 'REFUNDED'], default: 'PENDING' },
        escrowStatus:      { type: String, enum: ['UNLOCKED', 'LOCKED', 'SETTLED', 'REFUNDED'], default: 'UNLOCKED' },

        // ── Automated UPI gateway fields ─────────────────────────────────
        gatewayOrderId:       { type: String },   // provider session ref
        gatewayTransactionId: { type: String },   // provider txn ID from webhook
        webhookEventId:       { type: String },   // idempotency key (unique sparse index below)
        verifiedAt:           { type: Date },     // when webhook confirmed the payment

        // ── Legacy fields (kept for backward compat with in-flight orders) ───
        utrNumber:         { type: String },      // manually submitted UTR (retired)
        razorpayOrderId:   { type: String },      // legacy field name for internal txn ref
        razorpayPaymentId: { type: String }       // legacy field name for UTR storage
    },

    promoCode: { type: String },

    invoiceUrl: { type: String },
    shopNote:   { type: String }
}, { timestamps: true });

ShopOrderSchema.index({ shopId: 1, status: 1, createdAt: -1 }); // Shop dashboard filter
ShopOrderSchema.index({ customerId: 1, createdAt: -1 });        // Customer order history
ShopOrderSchema.index({ createdAt: -1 });                       // Admin list sort
ShopOrderSchema.index({ status: 1, createdAt: -1 });            // Status-based filtering
// Webhook idempotency — prevents duplicate processing of the same payment event
ShopOrderSchema.index(
    { 'payment.webhookEventId': 1 },
    { unique: true, sparse: true }
);

module.exports = mongoose.model('ShopOrder', ShopOrderSchema);
