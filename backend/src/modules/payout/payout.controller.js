const { StatusCodes } = require('http-status-codes');
const Payout = require('./payout.model');
const Customer = require('../customer/customer.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { getCache, setCache, delCache } = require('../../helpers/redis.helper');

const CACHE_KEY = 'admin_payouts';

exports.getPayouts = catchAsync(async (req, res) => {
    const { status } = req.query;
    const cacheKey = status ? `${CACHE_KEY}_${status}` : CACHE_KEY;
    
    const cachedData = await getCache(cacheKey);
    if (cachedData) return successResponse(res, cachedData, 'Payouts from cache');

    const query = {};
    if (status) query.status = status.toUpperCase();

    const payouts = await Payout.find(query)
        .populate('workerId', 'name city category wallet kyc')
        .populate({ path: 'shopId', select: 'name address kyc wallet ownerId ownerName' })
        .sort({ createdAt: -1 });

    await setCache(cacheKey, payouts, 300); // 5 min cache
    return successResponse(res, payouts, 'Payouts fetched successfully');
});

exports.updatePayoutStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status, txnId, rejectReason } = req.body;

    const payout = await Payout.findById(id);
    if (!payout) return errorResponse(res, 'Payout request not found', StatusCodes.NOT_FOUND);

    payout.status = status.toUpperCase();
    if (txnId) payout.txnId = txnId;
    if (rejectReason) payout.rejectReason = rejectReason;
    payout.processedAt = Date.now();

    await payout.save();

    // If rejected, refund the amount to worker wallet (simulation)
    // If transferred, the wallet was already deducted when request was made (logic assumption)

    await delCache(CACHE_KEY);
    return successResponse(res, payout, `Payout ${status.toLowerCase()} successfully`);
});
