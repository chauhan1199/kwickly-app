const { StatusCodes } = require('http-status-codes');
const Dispute = require('./dispute.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { getCache, setCache, delCache } = require('../../helpers/redis.helper');
const { triggerDashboardUpdate } = require('../../helpers/socket.helper');

const CACHE_KEY = 'admin_disputes_list';

exports.getDisputes = catchAsync(async (req, res) => {
    const cached = await getCache(CACHE_KEY);
    if (cached) return successResponse(res, cached, 'Disputes fetched');

    const disputes = await Dispute.find()
        .populate('customerId', 'name')
        .populate('workerId', 'name')
        .sort('-createdAt')
        .lean();
    
    await setCache(CACHE_KEY, disputes, 3600);
    
    return successResponse(res, disputes, 'Disputes fetched');
});

exports.updateDisputeStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status, resolutionNotes } = req.body;
    
    const dispute = await Dispute.findByIdAndUpdate(id, { 
        status, 
        resolutionNotes,
        resolvedAt: ['resolved', 'refunded'].includes(status) ? new Date() : undefined
    }, { new: true });

    if (!dispute) return errorResponse(res, 'Dispute not found', StatusCodes.NOT_FOUND);

    await delCache(CACHE_KEY);
    triggerDashboardUpdate();

    return successResponse(res, dispute, 'Dispute updated');
});
