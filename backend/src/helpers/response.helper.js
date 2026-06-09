const { StatusCodes } = require('http-status-codes');

/**
 * @desc Standard Success Response
 */
const successResponse = (res, data = null, message = 'Success', statusCode = StatusCodes.OK) => {
    return res.status(statusCode).json({
        status: 'success',
        message,
        data
    });
};

/**
 * @desc Standard Error Response
 */
const errorResponse = (res, message = 'Internal Server Error', statusCode = StatusCodes.INTERNAL_SERVER_ERROR, errors = null) => {
    return res.status(statusCode).json({
        status: 'error',
        message,
        errors
    });
};

module.exports = {
    successResponse,
    errorResponse
};
