const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const hpp = require('hpp');
const sanitizeMiddleware = require('./middleware/sanitize.middleware');
const compression = require('compression');
const errorHandler = require('./middleware/error.middleware');
const { globalLimiter } = require('./middleware/rateLimit.middleware');
const { requestId, slowRequestLogger } = require('./middleware/requestContext.middleware');

const app = express();

// Per-request tracing ID + slow-request (>=200ms) logging — must be first so
// every response carries X-Request-ID and all downstream timing is captured.
app.use(requestId);
app.use(slowRequestLogger);

// Trust proxy for Render / Cloud reverse proxies
app.set('trust proxy', 1);

// ─── Allowed Origins ─────────────────────────────────────────────────────────
// First-party deployments are always allowed. Keeping them in code means an
// incomplete ALLOWED_ORIGINS on the host can never lock our own admin panel out
// of its own API — the failure mode is a browser CORS block that looks like the
// panel "crashing" with no server-side error.
const FIRST_PARTY_ORIGINS = ['https://kwickly-app.vercel.app'];

const allowedOrigins = [
    ...FIRST_PARTY_ORIGINS,
    ...(process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:19006,http://localhost:5173,http://localhost:5174')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean),
];

// Enable CORS with wildcard and whitelist support
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true);
        // Suffix matching only outside production — in production the origin must be
        // explicitly whitelisted via ALLOWED_ORIGINS (no wildcard subdomain takeover).
        if (process.env.NODE_ENV !== 'production' &&
            (origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com'))) {
            return callback(null, true);
        }
        callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

// Set security HTTP headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));



// Development logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    // Production structured logging: request ID, userId, route, status, response time
    morgan.token('reqId', (req) => req.id || '-');
    morgan.token('userId', (req) => (req.user?._id || req.user?.id || '-').toString());
    app.use(morgan(':reqId :userId :method :url :status :response-time ms', {
        stream: { write: (message) => require('./helpers/logger.helper').info(message.trim()) }
    }));
}

// Body parser with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP Parameter Pollution Protection
app.use(hpp());

// Custom NoSQL Sanitization to replace incompatible express-mongo-sanitize
app.use(sanitizeMiddleware);

// Compress all responses
app.use(compression());

// Static file serving
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// ─── Global Rate Limiter ──────────────────────────────────────────────────────
app.use(globalLimiter);

// ─── Route Handlers ──────────────────────────────────────────────────────────
app.use('/api/v1/auth',          require('./modules/auth/auth.routes'));
app.use('/api/v1/admin',         require('./modules/admin/admin.routes'));
app.use('/api/v1/customers',     require('./modules/customer/customer.routes'));
app.use('/api/v1/categories',    require('./modules/category/category.routes'));
app.use('/api/v1/jobs',          require('./modules/job/job.routes'));
app.use('/api/v1/payouts',       require('./modules/payout/payout.routes'));
app.use('/api/v1/settings',      require('./modules/settings/settings.routes'));
app.use('/api/v1/notifications', require('./modules/notification/notification.routes'));
app.use('/api/v1/quotes',        require('./modules/quote/quote.routes'));
app.use('/api/v1/shops',         require('./modules/shop/shop.routes'));
app.use('/api/v1/products',      require('./modules/product/product.routes'));
app.use('/api/v1/shoporders',    require('./modules/shoporder/shoporder.routes'));
app.use('/api/v1/subscriptions', require('./modules/subscription/subscription.routes'));
app.use('/api/v1/wallet',        require('./modules/wallet/wallet.routes'));
app.use('/api/v1/workers',       require('./modules/worker/worker.routes'));
app.use('/api/v1/chat',          require('./modules/chat/chat.routes'));
app.use('/api/v1/cart',          require('./modules/cart/cart.routes'));

app.use('/api/v1/delivery-staff', require('./modules/deliveryStaff/deliveryStaff.routes'));
app.use('/api/v1/promotions',    require('./modules/promotion/promotion.routes'));
app.use('/api/v1/payments',      require('./modules/payment/payment.routes'));
app.use('/api/v1/admin/admin-wallet', require('./modules/adminWallet/adminWallet.routes'));
app.use('/api/v1/ledger',             require('./modules/ledger/platformLedger.routes'));

// Root & Health check — no auth, no rate limit
app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Kwickly API is live and running', timestamp: new Date() });
});

app.get('/health', (req, res) => {
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState; // 0=disconnected 1=connected 2=connecting 3=disconnecting
    const db = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
    // 503 when the DB is not usable so load balancers can pull the instance
    const healthy = dbState === 1;
    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        db,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ status: 'error', message: `Route ${req.originalUrl} not found` });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
