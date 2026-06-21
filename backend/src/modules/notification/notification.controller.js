const { StatusCodes } = require('http-status-codes');
const Notification = require('./notification.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToAll } = require('../../helpers/socket.helper');

exports.sendBroadcast = catchAsync(async (req, res) => {
    const { title, message, targetRole } = req.body;
    
    const notification = await Notification.create({
        title,
        message,
        type: 'BROADCAST',
        targetRole: targetRole || 'ALL'
    });

    // Real-time broadcast
    emitToAll('NOTIFICATION', { title, message, targetRole });

    return successResponse(res, notification, 'Broadcast sent successfully', StatusCodes.CREATED);
});

exports.getNotifications = catchAsync(async (req, res) => {
    const notifications = await Notification.find({
        $or: [
            { type: 'BROADCAST', targetRole: { $in: ['ALL', req.user.role] } },
            { type: 'ADMIN_ACTIVITY', targetRole: 'ADMIN' }
        ]
    })
        .sort({ createdAt: -1 })
        .limit(50);
    
    return successResponse(res, notifications, 'Notifications fetched successfully');
});

exports.getAdminActivityLogs = catchAsync(async (req, res) => {
    const { page = 1, limit = 30, type } = req.query;
    const query = { type: 'ADMIN_ACTIVITY', targetRole: 'ADMIN' };
    if (type && type !== 'all') query.action = type.toUpperCase();

    const total = await Notification.countDocuments(query);
    const logs = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit));

    return successResponse(res, { logs, total, page: Number(page), totalPages: Math.ceil(total / limit) }, 'Activity logs fetched');
});

exports.markAsRead = catchAsync(async (req, res) => {
    const notification = await Notification.findByIdAndUpdate(
        req.params.id,
        { $addToSet: { readBy: req.user._id } },
        { new: true }
    );
    return successResponse(res, notification, 'Marked as read');
});

exports.getMyNotifications = catchAsync(async (req, res) => {
    const query = {
        $or: [
            { userId: req.user._id },
            { type: 'BROADCAST', targetRole: { $in: ['ALL', req.user.role] } },
            { type: 'ADMIN_ACTIVITY', targetRole: 'ADMIN' }
        ]
    };
    const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(50);

    const unreadCount = notifications.filter(n => !n.readBy.includes(req.user._id)).length;

    return successResponse(res, { notifications, unreadCount }, 'Notifications fetched');
});

exports.markAllAsRead = catchAsync(async (req, res) => {
    const query = {
        $or: [
            { userId: req.user._id },
            { type: 'BROADCAST', targetRole: { $in: ['ALL', req.user.role] } },
            { type: 'ADMIN_ACTIVITY', targetRole: 'ADMIN' }
        ]
    };
    
    await Notification.updateMany(
        query,
        { $addToSet: { readBy: req.user._id } }
    );
    return successResponse(res, null, 'All marked as read');
});
