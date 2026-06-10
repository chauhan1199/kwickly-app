const express = require('express');
const router = express.Router();
const bannerController = require('./banner.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');

// Public routes (used by mobile apps to fetch active banners)
router.get('/active', bannerController.getActiveBanners);

// Protected routes (Admin only)
router.use(authMiddleware);
router.use(authorize('ADMIN'));

router.get('/', bannerController.getAllBanners);
router.post('/', bannerController.createBanner);
router.post('/demo', bannerController.generateDemoBanners);
router.put('/:id', bannerController.updateBanner);
router.delete('/:id', bannerController.deleteBanner);

module.exports = router;
