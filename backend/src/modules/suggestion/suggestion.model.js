const mongoose = require('mongoose');

const SuggestionSchema = new mongoose.Schema({
    workerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    type: {
        type: String,
        enum: ['new_category', 'new_subcategory'],
        required: true
    },
    payload: {
        parentCategory: { type: String },
        parentCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
        name: { type: String, required: true },
        icon: { type: String },
        description: { type: String, required: true },
        suggestedSubcategories: [String]
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    rejectReason: { type: String },
    submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

SuggestionSchema.index({ workerId: 1, status: 1 });

module.exports = mongoose.model('Suggestion', SuggestionSchema);
