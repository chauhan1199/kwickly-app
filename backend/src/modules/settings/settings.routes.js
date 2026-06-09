const express = require('express');
const router = express.Router();
const settingsController = require('./settings.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');

router.get('/public', settingsController.getPublicSettings);

router.use(authMiddleware);
router.use(authorize('ADMIN'));

router.get('/', settingsController.getSettings);
router.patch('/', settingsController.updateSettings);

module.exports = router;
