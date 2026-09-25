const express = require('express');
const router = express.Router();
const promoController = require('./promotion.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const validate = require('../../middleware/validate.middleware');
const {
    createBannerSchema,
    updateBannerSchema,
    createPromotionSchema,
    updatePromotionSchema,
    validatePromoCodeSchema
} = require('../../validators/promotion.validator');

router.get('/banners', promoController.getBanners);
router.get('/active',  promoController.getActivePromotions);
router.post('/validate', authMiddleware, validate(validatePromoCodeSchema), promoController.validatePromoCode);

router.use(authMiddleware);
router.use(authorize('ADMIN'));

router.get('/banners/all',     promoController.getAllBanners);
router.post('/banners',        validate(createBannerSchema), promoController.createBanner);
router.patch('/banners/:id',   validate(updateBannerSchema), promoController.updateBanner);
router.delete('/banners/:id',  promoController.deleteBanner);

router.get('/promotions',      promoController.getAllPromotions);
router.post('/promotions',     validate(createPromotionSchema), promoController.createPromotion);
router.patch('/promotions/:id',validate(updatePromotionSchema), promoController.updatePromotion);
router.delete('/promotions/:id',promoController.deletePromotion);

module.exports = router;
