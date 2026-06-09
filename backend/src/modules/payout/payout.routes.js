const express = require('express');
const router = express.Router();
const payoutController = require('./payout.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');

router.use(authMiddleware);
router.use(authorize('ADMIN'));

router.get('/', payoutController.getPayouts);
router.patch('/:id/status', payoutController.updatePayoutStatus);

module.exports = router;
