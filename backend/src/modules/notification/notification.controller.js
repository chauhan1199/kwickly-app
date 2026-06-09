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
    const notifications = await Notification.find({ type: 'BROADCAST' })
        .sort({ createdAt: -1 })
        .limit(50);
    
    return successResponse(res, notifications, 'Notifications fetched successfully');
});

exports.getMyNotifications = catchAsync(async (req, res) => {
    const query = {
        $or: [
            { userId: req.user._id },
            { type: 'BROADCAST', targetRole: { $in: ['ALL', req.user.role] } }
        ]
    };
    const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(50);
    
    // Calculate unread count
    const unreadCount = notifications.filter(n => !n.readBy.includes(req.user._id)).length;
    
    return successResponse(res, { notifications, unreadCount }, 'Notifications fetched');
});

exports.markAsRead = catchAsync(async (req, res) => {
    const notification = await Notification.findByIdAndUpdate(
        req.params.id,
        { $addToSet: { readBy: req.user._id } },
        { new: true }
    );
    return successResponse(res, notification, 'Marked as read');
});

exports.markAllAsRead = catchAsync(async (req, res) => {
    const query = {
        $or: [
            { userId: req.user._id },
            { type: 'BROADCAST', targetRole: { $in: ['ALL', req.user.role] } }
        ]
    };
    
    await Notification.updateMany(
        query,
        { $addToSet: { readBy: req.user._id } }
    );
    return successResponse(res, null, 'All marked as read');
});
