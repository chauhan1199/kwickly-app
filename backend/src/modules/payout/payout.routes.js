const express = require('express');
const router = express.Router();
const payoutController = require('./payout.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const validate = require('../../middleware/validate.middleware');
const { updatePayoutStatusSchema } = require('../../validators/payout.validator');

router.use(authMiddleware);
router.use(authorize('ADMIN'));

router.get('/', payoutController.getPayouts);
router.patch('/:id/status', validate(updatePayoutStatusSchema), payoutController.updatePayoutStatus);

module.exports = router;
