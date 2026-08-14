const express = require('express');
const router = express.Router();
const notificationController = require('./notification.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');

router.use(authMiddleware);

// ── Admin routes ─────────────────────────────────────────────────────────────
router.get('/',              authorize('ADMIN'), notificationController.getNotifications);
router.get('/activity-logs', authorize('ADMIN'), notificationController.getAdminActivityLogs);
router.post('/broadcast',    authorize('ADMIN'), notificationController.sendBroadcast);

// ── User routes ───────────────────────────────────────────────────────────────
router.get('/my',            notificationController.getMyNotifications);
router.get('/unread-count',  notificationController.getUnreadCount);
router.patch('/read-all',    notificationController.markAllAsRead);
router.patch('/:id/read',    notificationController.markAsRead);
router.delete('/:id',        notificationController.deleteNotification);
router.post('/push-token',   notificationController.registerPushToken);

module.exports = router;
