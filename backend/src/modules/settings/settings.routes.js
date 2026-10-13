const express = require('express');
const router = express.Router();
const settingsController = require('./settings.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');

router.get('/public', settingsController.getPublicSettings);
router.get('/public/stats', settingsController.getPublicStats);

router.use(authMiddleware);
router.use(authorize('ADMIN'));

const { validateUpdateSettings } = require('../../validators/settings.validator');

router.get('/', settingsController.getSettings);
router.patch('/', validateUpdateSettings, settingsController.updateSettings);

module.exports = router;
