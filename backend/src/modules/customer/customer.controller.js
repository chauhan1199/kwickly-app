const Customer = require('./customer.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse } = require('../../helpers/response.helper');

exports.getTopPros = catchAsync(async (req, res) => {
    const pros = await Customer.find({ role: 'WORKER', isVerified: true })
        .select('name phone profileImage activeLocation rating jobs')
        .sort('-rating')
        .limit(10);
        
    return successResponse(res, pros, 'Top pros fetched successfully');
});
