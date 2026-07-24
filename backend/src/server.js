require('dotenv').config();
const http = require('http');

// ─── Critical Environment Variable Check ─────────────────────────────────────
// Fail fast at startup rather than silently using insecure defaults.
const REQUIRED_ENV = ['JWT_SECRET', 'MONGO_URI'];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
    console.error(`[FATAL] Missing required environment variables: ${missingEnv.join(', ')}`);
    console.error('[FATAL] Server cannot start without these variables. Check your .env file.');
    process.exit(1);
}

const app = require('./app');
const connectDB = require('./config/db');
const { initRedis } = require('./helpers/redis.helper');
const { initSocket } = require('./helpers/socket.helper');
const { initSocketHandlers } = require('./sockets');
const { startCronEngine } = require('./workers/cronEngine');
const { startSubscriptionCron } = require('./cron/subscription.cron');
const logger = require('./helpers/logger.helper');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.io with JWT middleware
initSocket(server);
initSocketHandlers();

// Initialize Redis
initRedis();

const seedData = require('./helpers/seeder.helper');

// Initialize DB and start server
const startServer = async () => {
    try {
        await connectDB();

        // Only seed in development, never in production
        if (process.env.NODE_ENV !== 'production') {
            await seedData();
        }

        // Start Background Cron Engine
        startCronEngine();
        startSubscriptionCron();

        server.listen(PORT, () => {
            logger.info(`✅ Kwickly server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION:', err.message, err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('UNHANDLED REJECTION:', reason);
});

startServer();

// Trigger nodemon restart
