const express = require('express');
const router  = express.Router();
const ctrl    = require('./shoporder.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize          = require('../../middleware/role.middleware');
const validate           = require('../../middleware/validate.middleware');
const { placeOrderSchema, updateOrderStatusSchema } = require('../../validators/shoporder.validator');

// Customer
router.post('/',            authMiddleware, authorize('CUSTOMER'), validate(placeOrderSchema), ctrl.placeOrder);
router.get('/customer',     authMiddleware, authorize('CUSTOMER'), ctrl.getCustomerOrders);
router.post('/:id/cancel',  authMiddleware, authorize('CUSTOMER'), ctrl.cancelOrder);

// Shop owner
router.get('/shop',         authMiddleware, authorize('SHOP'),     ctrl.getShopOrders);
router.patch('/:id/status', authMiddleware, authorize('SHOP'),     validate(updateOrderStatusSchema), ctrl.updateOrderStatus);

// Admin
router.get('/all',          authMiddleware, authorize('ADMIN'),    ctrl.getAllOrders);
router.patch('/:id/status', authMiddleware, authorize('ADMIN'),    validate(updateOrderStatusSchema), ctrl.updateOrderStatus);

// Shared (customer + shop)
router.get('/:id',          authMiddleware,                          ctrl.getOrderById);
router.get('/:id/invoice',  authMiddleware,                          ctrl.downloadInvoice);

module.exports = router;
