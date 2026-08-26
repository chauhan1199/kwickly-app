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
        const firstMsg = errorDetails.length > 0 ? errorDetails[0].replace(/"/g, '') : 'Validation Error';
        return errorResponse(res, firstMsg, StatusCodes.BAD_REQUEST, errorDetails);
    }

    // Replace request object with validated value
    if (source === 'body') {
        req.body = value;
    } else {
        // Remove old unvalidated keys first, then assign validated keys
        for (const key of Object.keys(req[source])) {
            delete req[source][key];
        }
        Object.assign(req[source], value);
    }
    return next();
};

module.exports = validate;
