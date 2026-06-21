const mongoose = require('mongoose');
const logger = require('../helpers/logger.helper');

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI; // Required — enforced in server.js startup check

        const conn = await mongoose.connect(uri, {
            // Connection pool — handle 50k users with concurrent DB operations
            maxPoolSize: 20,
            minPoolSize: 5,

            // Timeouts
            serverSelectionTimeoutMS: 5000,  // Fail fast if MongoDB is unreachable
            socketTimeoutMS: 45000,          // Close idle sockets after 45s
            connectTimeoutMS: 10000,         // Connection timeout

            // Heartbeat
            heartbeatFrequencyMS: 10000,
        });

        logger.info(`✅ MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        logger.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

module.exports = connectDB;
