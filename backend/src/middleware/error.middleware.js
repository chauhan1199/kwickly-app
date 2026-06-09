const { StatusCodes } = require('http-status-codes');
const logger = require('../helpers/logger.helper');
const { errorResponse } = require('../helpers/response.helper');

/**
 * @desc Global Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
    logger.error(`${err.message} - ${req.method} ${req.originalUrl} - ${req.ip}`);

    // Default error status and message
    let statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    let message = err.message || 'Internal Server Error';
    let errors = err.errors || null;

    // Handle Mongoose Validation Error
    if (err.name === 'ValidationError') {
        statusCode = StatusCodes.BAD_REQUEST;
        message = 'Validation Error';
        errors = Object.values(err.errors).map(el => el.message);
    }

    // Handle JWT Errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = StatusCodes.UNAUTHORIZED;
        message = 'Invalid token. Please log in again.';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = StatusCodes.UNAUTHORIZED;
        message = 'Your token has expired. Please log in again.';
    }

    return errorResponse(res, message, statusCode, errors);
};

module.exports = errorHandler;
