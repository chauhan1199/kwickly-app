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

exports.openDispute = catchAsync(async (req, res) => {
    const { jobId, shopOrderId, reason, description } = req.body;
    const customerId = req.user._id;

    let targetId, model, field;
    if (jobId) {
        targetId = jobId;
        model = require('../job/job.model');
        field = 'jobId';
    } else {
        targetId = shopOrderId;
        model = require('../shoporder/shoporder.model');
        field = 'shopOrderId'; // Assuming you might add this to dispute model or rely on jobId field as generic ref
    }

    const item = await model.findById(targetId);
    if (!item) return errorResponse(res, 'Reference item not found', StatusCodes.NOT_FOUND);
    if (String(item.customerId) !== String(customerId)) {
        return errorResponse(res, 'Unauthorized to open dispute for this item', StatusCodes.FORBIDDEN);
    }

    const existingDispute = await Dispute.findOne({ customerId, [field]: targetId, status: { $ne: 'resolved' } });
    if (existingDispute) {
        return errorResponse(res, 'An active dispute already exists for this item', StatusCodes.CONFLICT);
    }

    const workerId = item.workerId || item.shopId; // Store shopId in workerId if shop order

    const dispute = await Dispute.create({
        [field]: targetId,
        customerId,
        workerId,
        reason,
        description,
        status: 'open'
    });

    await delCache(CACHE_KEY);
    triggerDashboardUpdate();

    return successResponse(res, dispute, 'Dispute opened successfully', StatusCodes.CREATED);
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
