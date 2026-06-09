const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const Customer = require('../modules/customer/customer.model');
const catchAsync = require('../helpers/async.helper');
const { AUTH } = require('../constants/messages');
const { errorResponse } = require('../helpers/response.helper');

/**
 * @desc Authentication middleware (Verify JWT)
 */
const authMiddleware = catchAsync(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return errorResponse(res, AUTH.NOT_AUTHENTICATED, StatusCodes.UNAUTHORIZED);
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'kwickly_secret_key');
        const user = await Customer.findById(decoded.id).select('-password');

        if (!user) {
            return errorResponse(res, AUTH.USER_NOT_FOUND, StatusCodes.UNAUTHORIZED);
        }

        // Add additional checks for Workers
        if (user.role === 'WORKER') {
            req.isVerifiedWorker = user.isVerified && user.kyc.status === 'APPROVED';
            req.walletBalance = user.wallet.balance;
        }

        req.user = user;
        next();
    } catch (error) {
        return errorResponse(res, AUTH.NOT_AUTHENTICATED, StatusCodes.UNAUTHORIZED);
    }
});

module.exports = { authMiddleware };
