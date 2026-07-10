const express = require('express');
const router = express.Router();
const ctrl = require('./adminWallet.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');

router.use(authMiddleware);
router.use(authorize('ADMIN'));

router.get('/balance', ctrl.getBalance);
router.get('/transactions', ctrl.getTransactions);
router.post('/credit', ctrl.credit);
router.post('/debit', ctrl.debit);
router.patch('/bank-details', ctrl.updateBankDetails);
router.post('/razorpay-order', ctrl.createRazorpayOrder);
router.post('/razorpay-verify', ctrl.verifyRazorpayPayment);

module.exports = router;
