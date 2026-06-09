const Customer = require('./customer.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse } = require('../../helpers/response.helper');
const { setCache, getCache } = require('../../helpers/redis.helper');

exports.getTopPros = catchAsync(async (req, res) => {
    const cachedData = await getCache('top_pros_list');
    if (cachedData) {
        return successResponse(res, cachedData, 'Top pros fetched from cache');
    }

    const pros = await Customer.find({ role: 'WORKER', isVerified: true })
        .select('name phone profileImage activeLocation rating jobs')
        .sort('-rating')
        .limit(10);
        
    await setCache('top_pros_list', pros, 3600); // cache for 1 hr

    return successResponse(res, pros, 'Top pros fetched successfully');
});
