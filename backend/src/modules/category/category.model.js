const mongoose = require('mongoose');

const SubcategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    imageUrl: { type: String, default: null },
    minPrice: { type: Number, default: 0 },
    platformFee: { type: Number, default: 50 },
    suggestedMax: { type: Number, default: null },
    active: { type: Boolean, default: true }
});

const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String, default: null },
    icon: { type: String, default: null },
    color: { type: String, default: '#000000' },
    imageUrl: { type: String, default: null },
    active: { type: Boolean, default: true },
    subcategories: [SubcategorySchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);
