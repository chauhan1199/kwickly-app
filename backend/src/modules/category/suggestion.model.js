const mongoose = require('mongoose');

const CategorySuggestionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    type: {
        type: String,
        enum: ['CATEGORY', 'SUBCATEGORY'],
        required: true
    },
    parentCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: function() { return this.type === 'SUBCATEGORY'; }
    },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING'
    },
    suggestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    adminFeedback: {
        type: String,
        trim: true
    }
}, { timestamps: true });

module.exports = mongoose.model('CategorySuggestion', CategorySuggestionSchema);
