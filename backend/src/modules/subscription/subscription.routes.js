const express = require('express');
const router  = express.Router();
const ctrl    = require('./subscription.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize          = require('../../middleware/role.middleware');

const { validateSubscribe } = require('../../validators/subscription.validator');

// Public — get available plans (no auth required)
router.get('/plans',           ctrl.getPlans);

// Worker / Shop — subscribe
router.post('/subscribe',   authMiddleware, authorize('WORKER', 'SHOP'), validateSubscribe, ctrl.subscribe);
router.get('/my',           authMiddleware, authorize('WORKER', 'SHOP'), ctrl.getMySubscriptions);

// Admin — all subscriptions
router.get('/all',          authMiddleware, authorize('ADMIN'),    ctrl.getAllSubscriptions);

module.exports = router;
