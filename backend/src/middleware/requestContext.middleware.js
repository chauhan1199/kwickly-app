const crypto = require('crypto');
const logger = require('../helpers/logger.helper');

/**
 * @desc Attaches a unique request ID to every request and echoes it in the
 *       X-Request-ID response header for end-to-end tracing.
 */
const requestId = (req, res, next) => {
    req.id = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
};

/**
 * @desc Logs any response slower than the threshold (default 200ms) so slow
 *       queries/endpoints are visible in production logs. Mounted after routes
 *       would miss timing — mount BEFORE route handlers and it measures via
 *       res 'finish' event.
 */
const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS || 200);

const slowRequestLogger = (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        if (ms >= SLOW_REQUEST_MS) {
            logger.warn(`SLOW ${req.method} ${req.originalUrl} ${res.statusCode} ${Math.round(ms)}ms [reqId=${req.id || '-'} userId=${req.user?._id || req.user?.id || '-'}]`);
        }
    });
    next();
};

module.exports = { requestId, slowRequestLogger, SLOW_REQUEST_MS };
