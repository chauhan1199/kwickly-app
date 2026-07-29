const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subtitle: { type: String },
    imageUrl: { type: String, required: true },
    linkType: { type: String, enum: ['SHOP', 'PRODUCT', 'CATEGORY', 'EXTERNAL', 'NONE'], default: 'NONE' },
    linkValue: { type: String },
    position: { type: String, enum: ['HOME_TOP', 'HOME_MIDDLE', 'SHOP_PAGE', 'CATEGORY_PAGE'], default: 'HOME_TOP' },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    startAt: { type: Date },
    endAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }
}, { timestamps: true });

BannerSchema.index({ isActive: 1, position: 1, priority: -1 });

const PromotionSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    title: { type: String, required: true },
    description: { type: String },
    type: { type: String, enum: ['FLAT_DISCOUNT', 'PERCENTAGE_DISCOUNT', 'FREE_DELIVERY', 'FIRST_ORDER', 'CASHBACK'], required: true },
    value: { type: Number, required: true, min: [0, 'Value cannot be negative'] },
    maxDiscountCap: { type: Number, min: [0, 'Cap cannot be negative'] },
    minOrderAmount: { type: Number, default: 0 },
    maxUsesTotal: { type: Number },
    maxUsesPerUser: { type: Number, default: 1 },
    usesCount: { type: Number, default: 0 },
    appliesTo: { type: String, enum: ['ALL', 'SHOPS', 'CATEGORIES', 'PRODUCTS'], default: 'ALL' },
    appliesToIds: [{ type: mongoose.Schema.Types.ObjectId }],
    applicableRoles: [{ type: String, enum: ['CUSTOMER', 'WORKER', 'SHOP'] }],
    isActive: { type: Boolean, default: true },
    startAt: { type: Date, default: Date.now },
    endAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }
}, { timestamps: true });

PromotionSchema.index({ isActive: 1, startAt: 1, endAt: 1 });

PromotionSchema.pre('save', async function() {
    if (this.endAt && this.startAt && this.endAt < this.startAt) {
        const err = new Error('End date cannot be before start date');
        err.statusCode = 400;
        throw err;
    }
});

PromotionSchema.pre(['updateOne', 'findOneAndUpdate'], async function() {
    const update = this.getUpdate();
    if (update.endAt && update.startAt && new Date(update.endAt) < new Date(update.startAt)) {
        const err = new Error('End date cannot be before start date');
        err.statusCode = 400;
        throw err;
    }
});

const UserPromoUsageSchema = new mongoose.Schema({
    promoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    usedAt: { type: Date, default: Date.now }
}, { timestamps: true });

UserPromoUsageSchema.index({ promoId: 1, userId: 1 });

module.exports = {
    Banner: mongoose.model('Banner', BannerSchema),
    Promotion: mongoose.model('Promotion', PromotionSchema),
    UserPromoUsage: mongoose.model('UserPromoUsage', UserPromoUsageSchema)
};
