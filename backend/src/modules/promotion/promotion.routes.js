const express = require('express');
const router = express.Router();
const promoController = require('./promotion.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');

router.get('/banners', promoController.getBanners);
router.post('/validate', authMiddleware, promoController.validatePromoCode);

router.use(authMiddleware);
router.use(authorize('ADMIN'));

router.get('/banners/all',     promoController.getAllBanners);
router.post('/banners',        promoController.createBanner);
router.patch('/banners/:id',   promoController.updateBanner);
router.delete('/banners/:id',  promoController.deleteBanner);

router.get('/promotions',      promoController.getAllPromotions);
router.post('/promotions',     promoController.createPromotion);
router.patch('/promotions/:id',promoController.updatePromotion);
router.delete('/promotions/:id',promoController.deletePromotion);

module.exports = router;
