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
        if (!data) return null;
        let parsed = JSON.parse(data);
        if (typeof parsed === 'string' && (parsed.startsWith('{') || parsed.startsWith('['))) {
            try { parsed = JSON.parse(parsed); } catch(e) {}
        }
        return parsed;
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
        // Automatically handle range suffixes for dashboard stats invalidation
        if (key === 'admin_dashboard_stats') {
            const ranges = ['week', 'month', 'quarter', 'year', 'all'];
            for (const r of ranges) {
                await client.del(`admin_dashboard_stats_${r}`);
            }
        }
        await client.del(key);
    } catch (error) {
        logger.error(`Redis delCache error: ${error.message}`);
    }
};

/**
 * @desc Delete keys matching pattern without blocking using SCAN
 */
const delCacheByPattern = async (pattern) => {
    const client = getRedis();
    if (!client) return;
    try {
        let cursor = '0';
        do {
            const res = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = res[0];
            const keys = res[1];
            if (keys.length > 0) {
                await client.del(keys);
            }
        } while (cursor !== '0');
    } catch (error) {
        logger.error(`Redis delCacheByPattern error: ${error.message}`);
    }
};

/**
 * @desc Fetch data with Cache Stampede prevention
 */
const fetchWithCache = async (key, ttlInSeconds, fetcher) => {
    let data = await getCache(key);
    if (data !== null) return data;
    
    const lockKey = `lock:${key}`;
    const client = getRedis();
    if (client) {
        const acquired = await client.set(lockKey, '1', 'NX', 'EX', 10);
        if (!acquired) {
            await new Promise(r => setTimeout(r, 200));
            data = await getCache(key);
            if (data !== null) return data;
        }
    }
    
    data = await fetcher();
    if (data !== null && data !== undefined) {
        await setCache(key, data, ttlInSeconds);
    }
    
    if (client) await client.del(lockKey);
    return data;
};

/**
 * @desc Acquire a distributed lock for background jobs
 */
const acquireLock = async (lockKey, ttlInSeconds = 50) => {
    const client = getRedis();
    if (!client) return false; // If redis is down, deny lock to avoid chaos
    try {
        const acquired = await client.set(`lock:${lockKey}`, '1', 'NX', 'EX', ttlInSeconds);
        return !!acquired;
    } catch (e) {
        return false;
    }
};

/**
 * @desc Release a distributed lock
 */
const releaseLock = async (lockKey) => {
    const client = getRedis();
    if (client) {
        try {
            await client.del(`lock:${lockKey}`);
        } catch (e) {}
    }
};

module.exports = {
    initRedis,
    getRedis,
    setCache,
    getCache,
    delCache,
    delCacheByPattern,
    fetchWithCache,
    acquireLock,
    releaseLock
};
