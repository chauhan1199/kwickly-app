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
router.post('/:id/delivery-otp', authMiddleware, authorize('CUSTOMER'), ctrl.regenerateDeliveryOtp);

// Shop owner / Admin
router.get('/shop',         authMiddleware, authorize('SHOP'),     ctrl.getShopOrders);
router.patch('/:id/status', authMiddleware, authorize('SHOP', 'ADMIN'), validate(updateOrderStatusSchema), ctrl.updateOrderStatus);
// Only an admin may approve a direct-UPI payment; a shop must never self-approve.
router.post('/:id/verify-payment', authMiddleware, authorize('ADMIN'), ctrl.verifyShopOrderPayment);

// Admin
router.get('/all',          authMiddleware, authorize('ADMIN'),    ctrl.getAllOrders);

// Shared (customer + shop)
router.get('/:id',          authMiddleware,                          ctrl.getOrderById);
router.get('/:id/invoice',  authMiddleware,                          ctrl.downloadInvoice);

module.exports = router;
