const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    shopId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },

    name:     { type: String, required: true },
    price:    { type: Number, required: true },
    imageUrl: { type: String },

    category: { type: String, default: 'General' },
    brand:    { type: String },
    unit:     { type: String, default: 'Piece' },
    description: { type: String },
    stock:    { type: Number, default: 0 },
    minQty:   { type: Number, default: 1 },
    
    attributes: [{
        name: { type: String, required: true },
        value: { type: String, required: true }
    }],

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

ProductSchema.index({ shopId: 1 });
ProductSchema.index({ isActive: 1 });

module.exports = mongoose.model('Product', ProductSchema);
