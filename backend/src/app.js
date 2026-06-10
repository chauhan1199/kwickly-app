const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const errorHandler = require('./middleware/error.middleware');

const app = express();

// Enable CORS (Move to top for preflight reliability)
app.use(cors());

// Set security HTTP headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Development logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Request logging for production
app.use(morgan('combined', { 
    stream: { write: (message) => require('./helpers/logger.helper').info(message.trim()) } 
}));

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Compress all responses
app.use(compression());
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Route handlers
app.use('/api/v1/auth',          require('./modules/auth/auth.routes'));
app.use('/api/v1/admin',         require('./modules/admin/admin.routes'));
app.use('/api/v1/customers',     require('./modules/customer/customer.routes'));
app.use('/api/v1/categories',    require('./modules/category/category.routes'));
app.use('/api/v1/jobs',          require('./modules/job/job.routes'));
app.use('/api/v1/payouts',       require('./modules/payout/payout.routes'));
app.use('/api/v1/settings',      require('./modules/settings/settings.routes'));
app.use('/api/v1/notifications', require('./modules/notification/notification.routes'));
// New modules
app.use('/api/v1/quotes',        require('./modules/quote/quote.routes'));
app.use('/api/v1/shops',         require('./modules/shop/shop.routes'));
app.use('/api/v1/products',      require('./modules/product/product.routes'));
app.use('/api/v1/shoporders',    require('./modules/shoporder/shoporder.routes'));
app.use('/api/v1/subscriptions', require('./modules/subscription/subscription.routes'));
app.use('/api/v1/wallet',        require('./modules/wallet/wallet.routes'));
app.use('/api/v1/workers',       require('./modules/worker/worker.routes'));
app.use('/api/v1/chat',          require('./modules/chat/chat.routes'));
app.use('/api/v1/banners',       require('./modules/banner/banner.routes'));
app.use('/api/v1/coupons',       require('./modules/coupon/coupon.routes'));

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Kwickly API is running' });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
