const express = require('express');
const router  = express.Router();
const ctrl    = require('./shop.controller');
const upload  = require('../../middleware/upload.middleware');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize          = require('../../middleware/role.middleware');
const validate           = require('../../middleware/validate.middleware');
const { createShopSchema, updateShopSchema, addPayoutMethodSchema, withdrawSchema, updateOwnerSchema, reviewKycSchema } = require('../../validators/shop.validator');

// Shop owner routes
router.post('/',                                    authMiddleware, validate(createShopSchema), ctrl.createShop);
router.get('/my',                                   authMiddleware, ctrl.getMyShop);
router.patch('/my',                                 authMiddleware, upload.single('logo'), validate(updateShopSchema), ctrl.updateMyShop);
router.patch('/my/owner',                           authMiddleware, validate(updateOwnerSchema), ctrl.updateOwnerName);
router.post('/my/payout-methods',                   authMiddleware, validate(addPayoutMethodSchema), ctrl.addPayoutMethod);
router.post('/my/withdraw',                         authMiddleware, validate(withdrawSchema), ctrl.requestWithdrawal);
router.patch('/my/payout-methods/:methodId/primary',authMiddleware, ctrl.setPrimaryPayout);
router.delete('/my/payout-methods/:methodId',       authMiddleware, ctrl.deletePayoutMethod);

// Admin routes
router.get('/',                                     authMiddleware,                       ctrl.getAllShops);
router.patch('/:id/kyc',                            authMiddleware, authorize('ADMIN'),  ctrl.reviewShopKyc);
router.patch('/:id/toggle',                         authMiddleware, authorize('ADMIN'),  ctrl.toggleShop);

// Public/Customer: browse shop
router.get('/:id',                                  authMiddleware,                       ctrl.getShopById);

module.exports = router;
