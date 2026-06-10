const express = require('express');
const router = express.Router();
const couponController = require('./coupon.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');

// Public route to validate coupon before checkout
router.post('/validate', couponController.validateCoupon);

// Protected routes (Admin only)
router.use(authMiddleware);
router.use(authorize('ADMIN'));

router.get('/', couponController.getAllCoupons);
router.post('/', couponController.createCoupon);
router.post('/demo', couponController.generateDemoCoupons);
router.put('/:id', couponController.updateCoupon);
router.delete('/:id', couponController.deleteCoupon);

module.exports = router;
