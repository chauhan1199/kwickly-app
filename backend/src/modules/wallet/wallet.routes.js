const express = require('express');
const router  = express.Router();
const ctrl    = require('./wallet.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize          = require('../../middleware/role.middleware');
const validate           = require('../../middleware/validate.middleware');
const { topupSchema, withdrawSchema, adjustSchema } = require('../../validators/wallet.validator');

// Any authenticated user — their own wallet
router.get('/balance',          authMiddleware,                        ctrl.getWallet);
router.post('/topup',           authMiddleware, validate(topupSchema), ctrl.topupWallet);
router.post('/withdraw',        authMiddleware, validate(withdrawSchema), ctrl.requestWithdrawal);
router.post('/lookup-recipient', authMiddleware,                       ctrl.lookupRecipient);
router.post('/transfer',        authMiddleware,                        ctrl.transferWallet);
router.get('/my-transactions',  authMiddleware,                        ctrl.getMyTransactions);
router.get('/transactions/:id/receipt-pdf', authMiddleware,           ctrl.getTransactionReceiptPdf);

// Admin
router.get('/transactions', authMiddleware, authorize('ADMIN'),   ctrl.getAllTransactions);
router.post('/adjust',      authMiddleware, authorize('ADMIN'), validate(adjustSchema), ctrl.adminAdjust);
router.get('/pending-topups', authMiddleware, authorize('ADMIN'), ctrl.getPendingTopups);
router.post('/pending-topups/:id/approve', authMiddleware, authorize('ADMIN'), ctrl.approvePendingTopup);
router.post('/pending-topups/:id/reject',  authMiddleware, authorize('ADMIN'), ctrl.rejectPendingTopup);

module.exports = router;
