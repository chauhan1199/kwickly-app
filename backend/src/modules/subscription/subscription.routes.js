const express = require('express');
const router  = express.Router();
const ctrl    = require('./subscription.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize          = require('../../middleware/role.middleware');

const { validateSubscribe } = require('../../validators/subscription.validator');

// Worker / Shop — subscribe
router.post('/subscribe',   authMiddleware, authorize('WORKER', 'SHOP'), validateSubscribe, ctrl.subscribe);
router.get('/my',           authMiddleware, authorize('WORKER', 'SHOP'), ctrl.getMySubscriptions);

// Admin — all subscriptions
router.get('/all',          authMiddleware, authorize('ADMIN'),    ctrl.getAllSubscriptions);

module.exports = router;
