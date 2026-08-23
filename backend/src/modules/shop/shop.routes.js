const express = require('express');
const router  = express.Router();
const ctrl    = require('./shop.controller');
const upload  = require('../../middleware/upload.middleware');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize          = require('../../middleware/role.middleware');
const validate           = require('../../middleware/validate.middleware');
const { createShopSchema, updateShopSchema, updateShopAdminSchema, addPayoutMethodSchema, withdrawSchema, updateOwnerSchema, reviewKycSchema } = require('../../validators/shop.validator');

// Shop owner routes
router.post('/',                                    authMiddleware, validate(createShopSchema), ctrl.createShop);
router.get('/my',                                   authMiddleware, authorize('SHOP'), ctrl.getMyShop);
router.patch('/my',                                 authMiddleware, authorize('SHOP'), upload.single('logo'), validate(updateShopSchema), ctrl.updateMyShop);
router.patch('/my/owner',                           authMiddleware, authorize('SHOP'), validate(updateOwnerSchema), ctrl.updateOwnerName);
router.post('/my/kyc/documents',                    authMiddleware, authorize('SHOP'), upload.single('document'), ctrl.uploadKycDocument);
router.delete('/my/kyc/documents/:docIndex',        authMiddleware, authorize('SHOP'), ctrl.removeKycDocument);
router.post('/my/payout-methods',                   authMiddleware, authorize('SHOP'), validate(addPayoutMethodSchema), ctrl.addPayoutMethod);
router.post('/my/withdraw',                         authMiddleware, authorize('SHOP'), validate(withdrawSchema), ctrl.requestWithdrawal);
router.patch('/my/payout-methods/:methodId/primary',authMiddleware, authorize('SHOP'), ctrl.setPrimaryPayout);
router.delete('/my/payout-methods/:methodId',       authMiddleware, authorize('SHOP'), ctrl.deletePayoutMethod);
router.delete('/my',                                 authMiddleware, authorize('SHOP'), ctrl.deleteMyShop);

// Delivery config
router.get('/:id/delivery-config',                  authMiddleware, ctrl.getDeliveryConfig);
router.patch('/:id/delivery-config',                authMiddleware, authorize('SHOP', 'ADMIN'), ctrl.updateDeliveryConfig);

// Admin routes
router.get('/',                                     authMiddleware,                       ctrl.getAllShops);
router.patch('/:id',                                authMiddleware, authorize('ADMIN'), validate(updateShopAdminSchema), ctrl.updateShopAdmin);
router.delete('/:id',                               authMiddleware, authorize('ADMIN'),  ctrl.deleteShop);
router.patch('/:id/kyc',                            authMiddleware, authorize('ADMIN'),  ctrl.reviewShopKyc);
router.patch('/:id/toggle',                         authMiddleware, authorize('ADMIN'),  ctrl.toggleShop);

// Public/Customer: browse shop
router.get('/:id',                                  authMiddleware,                       ctrl.getShopById);

module.exports = router;
