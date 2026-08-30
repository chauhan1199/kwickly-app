const express = require('express');
const router = express.Router();
const ctrl = require('./adminWallet.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const validate = require('../../middleware/validate.middleware');
const {
    creditSchema,
    debitSchema,
    razorpayOrderSchema,
    razorpayVerifySchema,
    bankDetailsSchema
} = require('../../validators/adminWallet.validator');

router.use(authMiddleware);
router.use(authorize('ADMIN'));

router.get('/balance', ctrl.getBalance);
router.get('/transactions', ctrl.getTransactions);
router.post('/credit', validate(creditSchema), ctrl.credit);
router.post('/debit', validate(debitSchema), ctrl.debit);
router.patch('/bank-details', validate(bankDetailsSchema), ctrl.updateBankDetails);
router.post('/razorpay-order', validate(razorpayOrderSchema), ctrl.createRazorpayOrder);
router.post('/razorpay-verify', validate(razorpayVerifySchema), ctrl.verifyRazorpayPayment);

module.exports = router;
