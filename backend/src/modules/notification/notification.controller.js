const { StatusCodes } = require('http-status-codes');
const Notification = require('./notification.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToAll } = require('../../helpers/socket.helper');

// ─── Push: register device FCM token (handles token rotation) ────────────────
exports.registerPushToken = catchAsync(async (req, res) => {
    const { fcmToken } = req.body;
    if (!fcmToken || typeof fcmToken !== 'string') {
        return errorResponse(res, 'fcmToken is required', StatusCodes.BAD_REQUEST);
    }
    const Customer = require('../customer/customer.model');
    await Customer.findByIdAndUpdate(req.user._id, { fcmToken });
    return successResponse(res, null, 'Push token registered successfully');
});

// ─── Admin: send broadcast ────────────────────────────────────────────────────
exports.sendBroadcast = catchAsync(async (req, res) => {
    const { title, message, targetRole } = req.body;
    
    const notification = await Notification.create({
        title,
        message,
        type: 'BROADCAST',
        targetRole: targetRole || 'ALL'
    });

    emitToAll('NEW_NOTIFICATION', { title, message, targetRole });

    return successResponse(res, notification, 'Broadcast sent successfully', StatusCodes.CREATED);
});

// ─── Admin: all notifications ─────────────────────────────────────────────────
exports.getNotifications = catchAsync(async (req, res) => {
    // Admin can view all notifications across the platform
    const notifications = await Notification.find({})
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
    
    return successResponse(res, notifications, 'Notifications fetched successfully');
});

// ─── Admin: activity logs ─────────────────────────────────────────────────────
exports.getAdminActivityLogs = catchAsync(async (req, res) => {
    const { page = 1, limit = 30, type } = req.query;
    const query = { type: 'ADMIN_ACTIVITY', targetRole: 'ADMIN' };
    if (type && type !== 'all') query.action = type.toUpperCase();

    const total = await Notification.countDocuments(query);
    const logs = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, {
        logs, total, page: Number(page),
        totalPages: Math.ceil(total / limit)
    }, 'Activity logs fetched');
});

const cleanMojibake = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/ðŸ›Žï¸|ðŸ›Ž|ðŸ›/g, '🛍️ ')
        .replace(/âœ…|âœ\.\.\.|âœ“|âœ/g, '✅ ')
        .replace(/ðŸŽ‰/g, '🎉 ')
        .replace(/â[\s\u0080-\u009F]*Œ|â\s*Œ|âŒ/g, '❌ ')
        .replace(/ðŸ’°|ðŸ’/g, '💰 ')
        .replace(/ðŸ””/g, '🔔 ')
        .replace(/ðŸšš/g, '🚚 ')
        .replace(/ðŸ‘‹/g, '👋 ')
        .replace(/ðŸ› ï¸|ðŸ› /g, '🛠️ ')
        .replace(/âœ¨/g, '✨ ')
        .replace(/Â/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

// ─── User: get MY notifications (DIRECT + BROADCAST for my role) ──────────────
exports.getMyNotifications = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const role   = req.user.role;   // CUSTOMER | WORKER | SHOP | ADMIN

    const query = {
        deletedBy: { $ne: userId },
        $or: [
            { type: 'DIRECT',    userId },
            { type: 'BROADCAST', targetRole: { $in: ['ALL', role] } },
            { type: 'SYSTEM',    userId },
            { type: 'SYSTEM',    userId: null, targetRole: { $in: ['ALL', role] } }
        ]
    };

    const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

    const cleanedNotifications = notifications.map(n => {
        const obj = n.toObject ? n.toObject() : { ...n };
        obj.title = cleanMojibake(obj.title);
        obj.message = cleanMojibake(obj.message);
        return obj;
    });

    const unreadCount = notifications.filter(
        n => !n.readBy.some(id => id.toString() === userId.toString())
    ).length;

    return successResponse(res, { notifications: cleanedNotifications, unreadCount }, 'Notifications fetched');
});

// ─── User: mark one as read ───────────────────────────────────────────────────
exports.markAsRead = catchAsync(async (req, res) => {
    const notification = await Notification.findById(req.params.id).lean();
    if (!notification) return errorResponse(res, 'Notification not found', StatusCodes.NOT_FOUND);

    // Ownership check — only mark if notification belongs to user or is broadcast for their role
    const userId = req.user._id;
    const role = req.user.role;
    const isOwner = notification.userId?.toString() === userId.toString();
    const isBroadcast = notification.type === 'BROADCAST' && ['ALL', role].includes(notification.targetRole);
    if (!isOwner && !isBroadcast && req.user.role !== 'ADMIN') {
        return errorResponse(res, 'Not authorized to modify this notification', StatusCodes.FORBIDDEN);
    }

    await Notification.findByIdAndUpdate(req.params.id, { $addToSet: { readBy: userId } });

    // Trim arrays to prevent unbounded growth on broadcast notifications
    const updated = await Notification.findById(req.params.id);
    if (updated) {
        if (updated.readBy.length > 10000) {
            updated.readBy = updated.readBy.slice(-10000);
            await updated.save();
        }
    }

    return successResponse(res, null, 'Marked as read');
});

// ─── User: mark all as read ───────────────────────────────────────────────────
exports.markAllAsRead = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const role   = req.user.role;

    let query;
    if (role === 'ADMIN') {
        query = {}; // Admin marks EVERYTHING they see as read
    } else {
        query = {
            deletedBy: { $ne: userId },
            $or: [
                { type: 'DIRECT',    userId },
                { type: 'BROADCAST', targetRole: { $in: ['ALL', role] } },
                { type: 'SYSTEM',    userId },
                { type: 'SYSTEM',    userId: null, targetRole: { $in: ['ALL', role] } }
            ]
        };
    }

    await Notification.updateMany(query, { $addToSet: { readBy: userId } });

    return successResponse(res, null, 'All marked as read');
});

// ─── User: soft-delete a notification ────────────────────────────────────────
exports.deleteNotification = catchAsync(async (req, res) => {
    const notification = await Notification.findById(req.params.id).lean();
    if (!notification) return errorResponse(res, 'Notification not found', StatusCodes.NOT_FOUND);

    // Ownership check
    const userId = req.user._id;
    const isOwner = notification.userId?.toString() === userId.toString();
    const isBroadcast = notification.type === 'BROADCAST' && ['ALL', req.user.role].includes(notification.targetRole);
    if (!isOwner && !isBroadcast && req.user.role !== 'ADMIN') {
        return errorResponse(res, 'Not authorized to delete this notification', StatusCodes.FORBIDDEN);
    }

    await Notification.findByIdAndUpdate(req.params.id, { $addToSet: { deletedBy: userId } });

    // Trim arrays to prevent unbounded growth on broadcast notifications
    const updated = await Notification.findById(req.params.id);
    if (updated) {
        if (updated.deletedBy.length > 10000) {
            updated.deletedBy = updated.deletedBy.slice(-10000);
            await updated.save();
        }
    }

    return successResponse(res, null, 'Notification deleted');
});

// ─── User: unread count only (for badge polling) ──────────────────────────────
exports.getUnreadCount = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const role   = req.user.role;

    const query = {
        deletedBy: { $ne: userId },
        readBy:    { $ne: userId },
        $or: [
            { type: 'DIRECT',    userId },
            { type: 'BROADCAST', targetRole: { $in: ['ALL', role] } },
            { type: 'SYSTEM',    userId },
            { type: 'SYSTEM',    userId: null, targetRole: { $in: ['ALL', role] } }
        ]
    };

    const count = await Notification.countDocuments(query);
    return successResponse(res, { unreadCount: count }, 'Unread count fetched');
});
