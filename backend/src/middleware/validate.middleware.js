const { StatusCodes } = require('http-status-codes');
const { errorResponse } = require('../helpers/response.helper');
const logger = require('../helpers/logger.helper');

/**
 * @desc Generic Validation Middleware
 * @param {Object} schema - Joi schema object
 * @param {String} source - Request object source (body, query, params)
 */
const validate = (schema, source = 'body') => (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
        abortEarly: false,
        allowUnknown: true,
        stripUnknown: true
    });

    if (error) {
        const errorDetails = error.details.map(detail => detail.message);
        logger.error('VALIDATION ERROR:', errorDetails);
        return errorResponse(res, 'Validation Error', StatusCodes.BAD_REQUEST, errorDetails);
    }

    // Replace request object with validated value
    // Note: In Express 5, req.query is a getter/read-only. Using Object.assign to update properties instead.
    if (source === 'body') {
        req.body = value;
    } else {
        Object.assign(req[source], value);
    }
    return next();
};

module.exports = validate;
