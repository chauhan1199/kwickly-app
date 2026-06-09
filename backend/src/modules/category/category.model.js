const mongoose = require('mongoose');

const SubcategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    minPrice: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    suggestedMax: { type: Number, default: 0 },
    active: { type: Boolean, default: true }
});

const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    icon: { type: String, required: true },
    color: { type: String, required: true },
    description: { type: String, required: true },
    active: { type: Boolean, default: true },
    subcategories: [SubcategorySchema]
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);
