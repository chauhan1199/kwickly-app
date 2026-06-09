require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initRedis } = require('./helpers/redis.helper');
const { initSocket } = require('./helpers/socket.helper');
const logger = require('./helpers/logger.helper');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const { initSocketHandlers } = require('./sockets');

// Initialize Socket.io
initSocket(server);
initSocketHandlers(); // Register Kwickly-specific event handlers

// Initialize Redis 
initRedis();

const seedData = require('./helpers/seeder.helper');

// Initialize DB and start server
const startServer = async () => {
    try {
        await connectDB();
        await seedData();
        server.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
