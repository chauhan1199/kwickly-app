const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
    imageUrl: { type: String },
    stockAtAdd: { type: Number }
}, { _id: true });

const CartSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    items: [CartItemSchema],
    subtotal: { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true }
}, { timestamps: true });

CartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Cart', CartSchema);
