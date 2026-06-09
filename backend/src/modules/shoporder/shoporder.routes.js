const express = require('express');
const router  = express.Router();
const ctrl    = require('./shoporder.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize          = require('../../middleware/role.middleware');

// Customer
router.post('/',            authMiddleware, authorize('CUSTOMER'), ctrl.placeOrder);
router.get('/customer',     authMiddleware, authorize('CUSTOMER'), ctrl.getCustomerOrders);

// Shop owner
router.get('/shop',         authMiddleware, authorize('SHOP'),     ctrl.getShopOrders);
router.patch('/:id/status', authMiddleware, authorize('SHOP'),     ctrl.updateOrderStatus);

// Admin
router.get('/all',          authMiddleware, authorize('ADMIN'),    ctrl.getAllOrders);

// Shared (customer + shop)
router.get('/:id',          authMiddleware,                          ctrl.getOrderById);

module.exports = router;
