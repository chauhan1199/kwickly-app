const express = require('express');
const router = express.Router();
const settlementController = require('./settlement.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');

router.use(authMiddleware);
router.use(authorize('ADMIN'));

router.get('/',                     settlementController.getSettlements);
router.get('/pending',              settlementController.getPendingSettlements);
router.post('/:id/settle',          settlementController.settle);
router.post('/bulk-settle',         settlementController.bulkSettle);

module.exports = router;
