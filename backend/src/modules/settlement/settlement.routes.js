const express = require('express');
const router = express.Router();
const settlementController = require('./settlement.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const validate = require('../../middleware/validate.middleware');
const { settleSchema, bulkSettleSchema } = require('../../validators/settlement.validator');

router.use(authMiddleware);
router.use(authorize('ADMIN'));

router.get('/',                     settlementController.getSettlements);
router.get('/pending',              settlementController.getPendingSettlements);
router.post('/:id/settle',          validate(settleSchema), settlementController.settle);
router.post('/bulk-settle',         validate(bulkSettleSchema), settlementController.bulkSettle);

module.exports = router;
