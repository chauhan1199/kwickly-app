const sanitizeMiddleware = require('../middleware/sanitize.middleware');
const authorize = require('../middleware/role.middleware');
const errorHandler = require('../middleware/error.middleware');
const validate = require('../middleware/validate.middleware');
const Joi = require('joi');

// ─── sanitizeMiddleware ─────────────────────────────────────────────────────────
describe('sanitizeMiddleware', () => {
    it('should strip XSS payload from req.body', () => {
        const req = {
            body: { name: '<script>alert("xss")</script>Safe Text' },
            query: {},
            params: {}
        };
        const res = {};
        const next = jest.fn();

        sanitizeMiddleware(req, res, next);

        expect(req.body.name).not.toContain('<script>');
        expect(req.body.name).toContain('Safe Text');
        expect(next).toHaveBeenCalled();
    });

    it('should strip XSS from nested body properties', () => {
        const req = {
            body: { user: { bio: '<img src=x onerror=alert(1)>' } },
            query: {},
            params: {}
        };
        const res = {};
        const next = jest.fn();

        sanitizeMiddleware(req, res, next);

        expect(req.body.user.bio).not.toContain('onerror');
    });

    it('should strip XSS from query parameters', () => {
        const req = {
            body: {},
            query: { search: '<script>hack</script>' },
            params: {}
        };
        const res = {};
        const next = jest.fn();

        sanitizeMiddleware(req, res, next);

        expect(req.query.search).not.toContain('<script>');
    });

    it('should strip XSS from params', () => {
        const req = {
            body: {},
            query: {},
            params: { id: '<svg/onload=alert(1)>' }
        };
        const res = {};
        const next = jest.fn();

        sanitizeMiddleware(req, res, next);

        // XSS is stripped by converting to HTML entities
        expect(req.params.id).toContain('&lt;');
        expect(req.params.id).not.toContain('<');
    });

    it('should delete NoSQL injection operators ($ prefix)', () => {
        const req = {
            body: { email: 'test@test.com', $gt: '' },
            query: {},
            params: {}
        };
        const res = {};
        const next = jest.fn();

        sanitizeMiddleware(req, res, next);

        expect(req.body.email).toBe('test@test.com');
        expect(req.body.$gt).toBeUndefined();
    });

    it('should delete keys containing dots (NoSQL dot notation)', () => {
        const req = {
            body: { 'user.name': 'hacker', legitimate: 'value' },
            query: {},
            params: {}
        };
        const res = {};
        const next = jest.fn();

        sanitizeMiddleware(req, res, next);

        expect(req.body['user.name']).toBeUndefined();
        expect(req.body.legitimate).toBe('value');
    });

    it('should handle arrays in body', () => {
        const req = {
            body: { items: ['<script>xss</script>', 'safe'] },
            query: {},
            params: {}
        };
        const res = {};
        const next = jest.fn();

        sanitizeMiddleware(req, res, next);

        expect(req.body.items[0]).not.toContain('<script>');
        expect(req.body.items[1]).toBe('safe');
    });

    it('should pass through when req.body is undefined', () => {
        const req = {};
        const res = {};
        const next = jest.fn();

        sanitizeMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
    });
});

// ─── role.middleware ────────────────────────────────────────────────────────────
describe('role.middleware (authorize)', () => {
    it('should allow request with correct role', () => {
        const middleware = authorize('ADMIN');
        const req = { user: { role: 'ADMIN' } };
        const res = {};
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('should allow request when user has one of multiple allowed roles', () => {
        const middleware = authorize('SHOP', 'ADMIN');
        const req = { user: { role: 'SHOP' } };
        const res = {};
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('should block request with wrong role', () => {
        const middleware = authorize('ADMIN');
        const req = { user: { role: 'CUSTOMER' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
            message: expect.stringContaining('permission')
        }));
    });

    it('should block request when user is not set', () => {
        const middleware = authorize('ADMIN');
        const req = {};
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should block worker from admin-only route', () => {
        const middleware = authorize('ADMIN');
        const req = { user: { role: 'WORKER' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should block customer from shop-only route', () => {
        const middleware = authorize('SHOP');
        const req = { user: { role: 'CUSTOMER' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });
});

// ─── error.middleware ───────────────────────────────────────────────────────────
describe('error.middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = { method: 'GET', originalUrl: '/test', ip: '127.0.0.1' };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
    });

    it('should handle generic errors with 500', () => {
        const err = new Error('Something went wrong');
        err.statusCode = 500;

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
            message: 'Something went wrong'
        }));
    });

    it('should handle Mongoose ValidationError with 400', () => {
        const err = new Error('Validation failed');
        err.name = 'ValidationError';
        err.errors = {
            name: { message: 'Name is required' },
            email: { message: 'Email is invalid' }
        };

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
            message: 'Validation Error'
        }));
    });

    it('should handle MongoDB duplicate key error (code 11000) with 409', () => {
        const err = new Error('duplicate key error');
        err.code = 11000;
        err.keyValue = { email: 'test@test.com' };

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
            message: expect.stringContaining('already exists')
        }));
    });

    it('should handle CastError (invalid ObjectId) with 400', () => {
        const err = new Error('Cast to ObjectId failed');
        err.name = 'CastError';
        err.path = '_id';

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
            message: expect.stringContaining('_id')
        }));
    });

    it('should handle JsonWebTokenError with 401', () => {
        const err = new Error('jwt malformed');
        err.name = 'JsonWebTokenError';

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
            message: expect.stringContaining('token')
        }));
    });

    it('should handle TokenExpiredError with 401', () => {
        const err = new Error('jwt expired');
        err.name = 'TokenExpiredError';

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
            message: expect.stringContaining('expired')
        }));
    });

    it('should handle errors with custom statusCode', () => {
        const err = new Error('Not found');
        err.statusCode = 404;

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
            message: 'Not found'
        }));
    });
});

// ─── validate.middleware ────────────────────────────────────────────────────────
describe('validate.middleware', () => {
    it('should pass through valid input', () => {
        const schema = Joi.object({
            name: Joi.string().required(),
            age: Joi.number().required()
        });
        const middleware = validate(schema);

        const req = { body: { name: 'John', age: 30 } };
        const res = {};
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).toBeUndefined();
    });

    it('should return 400 with error details for invalid input', () => {
        const schema = Joi.object({
            name: Joi.string().required(),
            email: Joi.string().email().required()
        });
        const middleware = validate(schema);

        const req = { body: { name: 'John' } }; // missing email
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
            message: 'email is required',
            errors: ['"email" is required']
        }));
    });

    it('should return 400 when body is empty for required fields', () => {
        const schema = Joi.object({
            phone: Joi.string().min(10).required(),
            role: Joi.string().valid('CUSTOMER', 'WORKER', 'SHOP').required()
        });
        const middleware = validate(schema);

        const req = { body: {} };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should strip unknown fields when stripUnknown is true', () => {
        const schema = Joi.object({
            name: Joi.string().required()
        });
        const middleware = validate(schema);

        const req = { body: { name: 'John', unknownField: 'should be removed' } };
        const res = {};
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.body.unknownField).toBeUndefined();
        expect(req.body.name).toBe('John');
    });

    it('should validate query parameters', () => {
        const schema = Joi.object({
            page: Joi.number().integer().min(1).default(1),
            limit: Joi.number().integer().min(1).max(100).default(20)
        });
        const middleware = validate(schema, 'query');

        const req = { query: { page: '2', limit: '50' } };
        const res = {};
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('should return 400 for invalid query parameters', () => {
        const schema = Joi.object({
            page: Joi.number().integer().min(1).required()
        });
        const middleware = validate(schema, 'query');

        const req = { query: { page: 'abc' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should collect multiple validation errors', () => {
        const schema = Joi.object({
            name: Joi.string().required(),
            email: Joi.string().email().required(),
            age: Joi.number().min(0).required()
        });
        const middleware = validate(schema);

        const req = { body: {} };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        const body = res.json.mock.calls[0][0];
        expect(body.errors).toBeDefined();
        expect(body.errors.length).toBeGreaterThanOrEqual(2);
    });
});
