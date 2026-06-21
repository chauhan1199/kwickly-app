const express = require('express');
const router = express.Router();
const ctrl = require('./paymentMethod.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');

router.use(authMiddleware);

router.get('/bank-accounts',            ctrl.getBankAccounts);
router.post('/bank-accounts',           ctrl.addBankAccount);
router.delete('/bank-accounts/:id',     ctrl.deleteBankAccount);
router.patch('/bank-accounts/:id/set-default', ctrl.setDefaultBank);

router.get('/upi-accounts',             ctrl.getUpiAccounts);
router.post('/upi-accounts',            ctrl.addUpiAccount);
router.delete('/upi-accounts/:id',      ctrl.deleteUpiAccount);
router.patch('/upi-accounts/:id/set-default', ctrl.setDefaultUpi);

module.exports = router;
