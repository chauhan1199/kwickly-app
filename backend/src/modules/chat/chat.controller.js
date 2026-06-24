const { StatusCodes } = require('http-status-codes');
const Message = require('./message.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse } = require('../../helpers/response.helper');

exports.getChatHistory = catchAsync(async (req, res) => {
    const { partnerId, jobId } = req.query;
    const userId = req.user._id;
    
    let query = {};
    if (jobId) {
        query.jobId = jobId;
    } else if (partnerId) {
        query.$or = [
            { senderId: userId, receiverId: partnerId },
            { senderId: partnerId, receiverId: userId }
        ];
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
    // Usually sent via sockets, but having a fallback REST endpoint is good
    const { receiverId, jobId, text, mediaUrl } = req.body;
    
    const message = await Message.create({
        senderId: req.user._id,
        receiverId,
        jobId,
        text,
        mediaUrl
    });

    return successResponse(res, message, 'Message sent');
});
