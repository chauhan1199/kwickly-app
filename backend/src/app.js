const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const errorHandler = require('./middleware/error.middleware');
const { globalLimiter } = require('./middleware/rateLimit.middleware');

const app = express();

// ─── Allowed Origins ─────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:19006,http://localhost:5173,http://localhost:5174')
    .split(',')
    .map(o => o.trim());

// Enable CORS with strict origin whitelist
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Set security HTTP headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// HTTP Parameter Pollution protection (Incompatible with Express 5 getters)
// app.use(hpp());

// NoSQL Injection protection (sanitize mongo queries)
// Incompatible with Express 5 getters. Relying on Joi validation instead.
// app.use(mongoSanitize());

// Development logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    // Production structured logging
    app.use(morgan('combined', {
        stream: { write: (message) => require('./helpers/logger.helper').info(message.trim()) }
    }));
}

// Body parser with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Compress all responses
app.use(compression());

// Static file serving
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// ─── Global Rate Limiter ─────────────────────────────────────────────────────
app.use('/api/', globalLimiter);

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

// Health check — no auth, no rate limit
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Kwickly API is running' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ status: 'error', message: `Route ${req.originalUrl} not found` });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
