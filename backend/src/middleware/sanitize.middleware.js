const xss = require('xss');

/**
 * Deep sanitization for NoSQL Injection and XSS
 * - Recursively traverses arrays and objects
 * - Safely handles prototype pollution vectors
 * - Deletes keys starting with '$' or containing '.' (NoSQL operators)
 * - Runs 'xss()' on all string values to strip malicious HTML/scripts
 */
const sanitize = (obj) => {
    if (typeof obj === 'string') {
        return xss(obj);
    }
    
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            obj[i] = sanitize(obj[i]);
        }
        return obj;
    }

    for (const key of Object.keys(obj)) {
        // Prevent Prototype Pollution
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            delete obj[key];
            continue;
        }

        // Prevent NoSQL Injection Operators
        if (key.startsWith('$') || key.includes('.')) {
            delete obj[key];
            continue;
        }

        // Recursively sanitize nested properties
        obj[key] = sanitize(obj[key]);
    }
    
    return obj;
};

const sanitizeMiddleware = (req, res, next) => {
    if (req.body) req.body = sanitize(req.body);
    if (req.query) req.query = sanitize(req.query);
    if (req.params) req.params = sanitize(req.params);
    next();
};

module.exports = sanitizeMiddleware;
