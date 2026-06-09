const Redis = require('ioredis');
const logger = require('./logger.helper');

let redis = null;
let connectionAttempts = 0;
const MAX_LOG_ATTEMPTS = 3;

/**
 * @desc Initialize Redis connection with graceful retry strategy
 */
const initRedis = () => {
    try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        
        redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                connectionAttempts++;
                // Exponential backoff or max 2 seconds
                const delay = Math.min(times * 50, 2000);
                
                if (times > 5) {
                    if (connectionAttempts === MAX_LOG_ATTEMPTS + 1) {
                        logger.warn('Redis connection failed after multiple attempts. Real-time features (Socket.io synchronization) will be limited until Redis is available.');
                    }
                    return null; // Stop retrying indefinitely to prevent log flood
                }
                return delay;
            }
        });

        redis.on('connect', () => {
            connectionAttempts = 0;
            logger.info('Successfully connected to Redis');
        });

        redis.on('error', (error) => {
            // Only log the first few errors to avoid flooding console
            if (connectionAttempts <= MAX_LOG_ATTEMPTS) {
                logger.error(`Redis connection error: ${error.message}`);
            }
        });

        return redis;
    } catch (error) {
        logger.error('Failed to initialize Redis:', error);
        return null;
    }
};

/**
 * @desc Get active Redis instance
 */
const getRedis = () => {
    if (!redis) {
        return initRedis();
    }
    return redis;
};

/**
 * @desc Set data in cache with TTL
 */
const setCache = async (key, value, ttlInSeconds = 3600) => {
    const client = getRedis();
    if (!client) return null;
    try {
        await client.set(key, JSON.stringify(value), 'EX', ttlInSeconds);
    } catch (error) {
        logger.error(`Redis setCache error: ${error.message}`);
    }
};

/**
 * @desc Get data from cache
 */
const getCache = async (key) => {
    const client = getRedis();
    if (!client) return null;
    try {
        const data = await client.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        logger.error(`Redis getCache error: ${error.message}`);
        return null;
    }
};

/**
 * @desc Delete data from cache
 */
const delCache = async (key) => {
    const client = getRedis();
    if (!client) return null;
    try {
        await client.del(key);
    } catch (error) {
        logger.error(`Redis delCache error: ${error.message}`);
    }
};

module.exports = {
    initRedis,
    getRedis,
    setCache,
    getCache,
    delCache
};
