const mongoose = require('mongoose');

const SubcategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    imageUrl: { type: String, default: null },
    active: { type: Boolean, default: true }
});

const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    imageUrl: { type: String, default: null },
    active: { type: Boolean, default: true },
    subcategories: [SubcategorySchema]
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);
