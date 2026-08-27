const express = require('express');
const router = express.Router();
const ledgerController = require('./platformLedger.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');

// All ledger endpoints require ADMIN authorization
router.use(authMiddleware);
router.use(authorize('ADMIN'));

router.get('/',                  ledgerController.getLedgerEntries);
router.get('/reconciliation',    ledgerController.getReconciliation);
router.get('/treasury-summary',  ledgerController.getTreasurySummary);
router.get('/gst-report',        ledgerController.getGstReport);

module.exports = router;
