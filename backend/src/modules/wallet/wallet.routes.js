const express = require('express');
const router  = express.Router();
const ctrl    = require('./wallet.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize          = require('../../middleware/role.middleware');
const validate           = require('../../middleware/validate.middleware');
const { topupSchema, withdrawSchema, adjustSchema } = require('../../validators/wallet.validator');

// Any authenticated user — their own wallet
router.get('/balance',      authMiddleware,                        ctrl.getWallet);
router.post('/topup',       authMiddleware, validate(topupSchema), ctrl.topupWallet);
router.post('/withdraw',    authMiddleware, validate(withdrawSchema), ctrl.requestWithdrawal);

// Admin
router.get('/transactions', authMiddleware, authorize('ADMIN'),   ctrl.getAllTransactions);
router.post('/adjust',      authMiddleware, authorize('ADMIN'), validate(adjustSchema), ctrl.adminAdjust);

module.exports = router;
