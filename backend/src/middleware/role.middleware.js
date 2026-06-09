const { StatusCodes } = require('http-status-codes');
const { AUTH } = require('../constants/messages');
const { errorResponse } = require('../helpers/response.helper');

/**
 * @desc Authorization middleware (Role-based access control)
 * @param {...String} roles - Allowed roles
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return errorResponse(res, AUTH.UNAUTHORIZED, StatusCodes.FORBIDDEN);
        }
        next();
    };
};

module.exports = authorize;
