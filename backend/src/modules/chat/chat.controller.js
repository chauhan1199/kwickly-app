const { StatusCodes } = require('http-status-codes');
const Message = require('./message.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');

exports.getChatHistory = catchAsync(async (req, res) => {
    const { partnerId, jobId } = req.query;
    const userId = req.user._id;
    const isAdmin = req.user.role === 'ADMIN';
    
    let query = {};
    if (jobId) {
        // Authorization check: user must be involved in this job's chat
        const Job = require('../job/job.model');
        const job = await Job.findById(jobId).select('customerId workerId').lean();
        if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);
        
        const isJobParticipant = 
            job.customerId?.toString() === userId.toString() ||
            job.workerId?.toString() === userId.toString();
        
        if (!isAdmin && !isJobParticipant) {
            return errorResponse(res, 'Not authorized to view this chat', StatusCodes.FORBIDDEN);
        }
        
        query.jobId = jobId;
    } else if (partnerId === 'admin') {
        query.$or = [
            { senderId: userId, receiverId: null },
            { receiverId: userId, senderId: null }
        ];
    } else if (partnerId) {
        if (isAdmin) {
            query.$or = [
                { senderId: null, receiverId: partnerId },
                { senderId: partnerId, receiverId: null }
            ];
        } else {
            query.$or = [
                { senderId: userId, receiverId: partnerId },
                { senderId: partnerId, receiverId: userId }
            ];
        }
    } else {
        query.$or = [
            { senderId: userId },
            { receiverId: userId }
        ];
    }

    const messages = await Message.find(query)
        .populate('senderId', 'name profileImage role')
        .sort('createdAt')
        .limit(100);

    return successResponse(res, messages, 'Chat history fetched successfully');
});

exports.sendMessage = catchAsync(async (req, res) => {
    const { receiverId, jobId, text, mediaUrl } = req.body;

    if ((!text || !String(text).trim()) && !mediaUrl) {
        return errorResponse(res, 'Message text or media is required', StatusCodes.BAD_REQUEST);
    }
    
    // If admin is replying, senderId is null.
    const isAdmin = req.user.role === 'ADMIN';
    const isSendingToSystem = receiverId === 'admin' || receiverId === null;
    
    const message = await Message.create({
        senderId: isAdmin ? null : req.user._id,
        receiverId: isSendingToSystem ? null : receiverId,
        jobId,
        text,
        mediaUrl
    });

    await message.populate('senderId', 'name profileImage role');

    const { emitToUser, emitToRoom } = require('../../helpers/socket.helper');
    
    if (isAdmin && message.receiverId) {
        // Admin replying to a user — emit NEW_MESSAGE to that user's room
        emitToUser(message.receiverId.toString(), 'NEW_MESSAGE', message);
        // Also echo back to admin dashboard so other admin tabs stay in sync
        emitToRoom('admin_dashboard', 'ADMIN_MESSAGE_SENT', message);
    } else if (!isAdmin && isSendingToSystem) {
        // User messaging support — notify admin dashboard
        emitToRoom('admin_dashboard', 'SUPPORT_MESSAGE_RECEIVED', message);
    } else if (message.receiverId) {
        // User-to-user (e.g., job chat)
        emitToUser(message.receiverId.toString(), 'NEW_MESSAGE', message);
    }

    return successResponse(res, message, 'Message sent');
});

exports.markAsRead = catchAsync(async (req, res) => {
    const { partnerId } = req.body;
    const userId = req.user._id;
    const isAdmin = req.user.role === 'ADMIN';
    
    let query;
    if (isAdmin && partnerId) {
        // Admin marking messages from a specific user as read
        query = { senderId: partnerId, receiverId: null, isRead: false };
    } else {
        // User marking admin replies as read
        query = { senderId: null, receiverId: userId, isRead: false };
    }
    
    await Message.updateMany(query, { isRead: true });
    return successResponse(res, null, 'Messages marked as read');
});

exports.getSupportThreads = catchAsync(async (req, res) => {
    const threads = await Message.aggregate([
        {
            $match: {
                $or: [
                    { receiverId: null },
                    { senderId: null }
                ]
            }
        },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: {
                    $cond: [
                        { $eq: ["$senderId", null] },
                        "$receiverId",
                        "$senderId"
                    ]
                },
                latestMessage: { $first: "$$ROOT" },
                unreadCount: {
                    $sum: {
                        $cond: [
                            { $and: [
                                { $eq: ["$receiverId", null] },
                                { $eq: ["$isRead", false] }
                            ] },
                            1,
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const Customer = require('../customer/customer.model');
    const populatedThreads = await Customer.populate(threads, { path: '_id', select: 'name email profileImage role phone' });

    const formattedThreads = populatedThreads
        .filter(t => t._id) // Remove any threads with deleted users
        .map(thread => ({
            user: thread._id,
            latestMessage: thread.latestMessage,
            unreadCount: thread.unreadCount
        }))
        .sort((a, b) => new Date(b.latestMessage.createdAt) - new Date(a.latestMessage.createdAt));

    return successResponse(res, formattedThreads, 'Support threads fetched');
});
