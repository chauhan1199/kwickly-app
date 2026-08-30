const Joi = require('joi');

const bannerFields = {
    title: Joi.string().min(1).max(200),
    subtitle: Joi.string().allow('', null).max(300),
    imageUrl: Joi.string().min(1).max(2048),
    linkType: Joi.string().valid('SHOP', 'PRODUCT', 'CATEGORY', 'EXTERNAL', 'NONE'),
    linkValue: Joi.string().allow('', null),
    position: Joi.string().valid('HOME_TOP', 'HOME_MIDDLE', 'SHOP_PAGE', 'CATEGORY_PAGE'),
    isActive: Joi.boolean(),
    priority: Joi.number().integer().min(0),
    startAt: Joi.date().iso().allow(null),
    endAt: Joi.date().iso().allow(null)
};

const promotionFields = {
    code: Joi.string().min(1).max(50),
    title: Joi.string().min(1).max(200),
    description: Joi.string().allow('', null).max(1000),
    type: Joi.string().valid('FLAT_DISCOUNT', 'PERCENTAGE_DISCOUNT', 'FREE_DELIVERY', 'FIRST_ORDER', 'CASHBACK'),
    value: Joi.number().min(0),
    maxDiscountCap: Joi.number().min(0).allow(null),
    minOrderAmount: Joi.number().min(0),
    maxUsesTotal: Joi.number().integer().min(0).allow(null),
    maxUsesPerUser: Joi.number().integer().min(0),
    appliesTo: Joi.string().valid('ALL', 'SHOPS', 'CATEGORIES', 'PRODUCTS'),
    applicableRoles: Joi.array().items(Joi.string().valid('CUSTOMER', 'WORKER', 'SHOP')),
    isActive: Joi.boolean(),
    startAt: Joi.date().iso().allow(null),
    endAt: Joi.date().iso().allow(null)
};

// POST /banners — title & imageUrl required (model required fields)
const createBannerSchema = Joi.object({
    ...bannerFields,
    title: bannerFields.title.required(),
    imageUrl: bannerFields.imageUrl.required()
});

// PATCH /banners/:id — all optional, at least one field
const updateBannerSchema = Joi.object(bannerFields).min(1);

// POST /promotions — code, title, type, value required (model required fields)
const createPromotionSchema = Joi.object({
    ...promotionFields,
    code: promotionFields.code.required(),
    title: promotionFields.title.required(),
    type: promotionFields.type.required(),
    value: promotionFields.value.required()
});

// PATCH /promotions/:id — all optional, at least one field
const updatePromotionSchema = Joi.object(promotionFields).min(1);

// POST /validate — public promo code check at checkout
const validatePromoCodeSchema = Joi.object({
    code: Joi.string().min(1).max(50).required(),
    orderAmount: Joi.number().min(0).required(),
    userId: Joi.string().allow('', null),
    userRole: Joi.string().valid('CUSTOMER', 'WORKER', 'SHOP', 'ADMIN').allow('', null)
});

module.exports = {
    createBannerSchema,
    updateBannerSchema,
    createPromotionSchema,
    updatePromotionSchema,
    validatePromoCodeSchema
};
