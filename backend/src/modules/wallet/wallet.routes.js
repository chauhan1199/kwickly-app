const express = require('express');
const router  = express.Router();
const ctrl    = require('./wallet.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize          = require('../../middleware/role.middleware');

// Any authenticated user — their own wallet
router.get('/balance',      authMiddleware,                        ctrl.getWallet);
router.post('/topup',       authMiddleware,                        ctrl.topupWallet);
router.post('/withdraw',    authMiddleware,                        ctrl.requestWithdrawal);

// Admin
router.get('/transactions', authMiddleware, authorize('ADMIN'),   ctrl.getAllTransactions);
router.post('/adjust',      authMiddleware, authorize('ADMIN'),   ctrl.adminAdjust);

module.exports = router;
