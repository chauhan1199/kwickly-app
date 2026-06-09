const express = require('express');
const router  = express.Router();
const ctrl    = require('./shop.controller');
const upload  = require('../../middleware/upload.middleware');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize          = require('../../middleware/role.middleware');

// Shop owner routes
router.post('/',                                    authMiddleware, ctrl.createShop);
router.get('/my',                                   authMiddleware, ctrl.getMyShop);
router.patch('/my',                                 authMiddleware, upload.single('logo'), ctrl.updateMyShop);
router.patch('/my/owner',                           authMiddleware, ctrl.updateOwnerName);
router.post('/my/payout-methods',                   authMiddleware, ctrl.addPayoutMethod);
router.post('/my/withdraw',                         authMiddleware, ctrl.requestWithdrawal);
router.patch('/my/payout-methods/:methodId/primary',authMiddleware, ctrl.setPrimaryPayout);
router.delete('/my/payout-methods/:methodId',       authMiddleware, ctrl.deletePayoutMethod);

// Admin routes
router.get('/',                                     authMiddleware, authorize('ADMIN'),  ctrl.getAllShops);
router.patch('/:id/kyc',                            authMiddleware, authorize('ADMIN'),  ctrl.reviewShopKyc);
router.patch('/:id/toggle',                         authMiddleware, authorize('ADMIN'),  ctrl.toggleShop);

// Public/Customer: browse shop
router.get('/:id',                                  authMiddleware,                       ctrl.getShopById);

module.exports = router;
