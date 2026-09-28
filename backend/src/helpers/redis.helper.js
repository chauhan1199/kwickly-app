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
            enableOfflineQueue: false,
            retryStrategy(times) {
                connectionAttempts++;
                if (times > 5) {
                    if (connectionAttempts === MAX_LOG_ATTEMPTS + 1) {
                        logger.warn('Redis connection failed after multiple attempts. Will keep retrying with longer delays.');
                    }
                    // Keep retrying at longer intervals instead of stopping permanently
                    return Math.min(times * 5000, 60000);
                }
                return Math.min(times * 50, 2000);
            }
        });

        redis.on('connect', () => {
            connectionAttempts = 0;
            logger.info('Successfully connected to Redis');
        });

        redis.on('error', (error) => {
            if (connectionAttempts === 1) {
                logger.warn(`Redis unavailable (${error?.code || error?.message || 'ECONNREFUSED'}). Operating with in-memory fallback.`);
            }
        });

        return redis;
    } catch (error) {
        logger.error('Failed to initialize Redis:', error);
        return null;
    }
};

const isClientReady = (client) => {
    if (!client) return false;
    if (client.status === undefined) return true; // Allows mocked redis in unit tests
    return client.status === 'ready' || client.status === 'connect';
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
    if (!isClientReady(client)) return null;
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
    if (!isClientReady(client)) return null;
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
    if (!isClientReady(client)) return null;
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
    if (!isClientReady(client)) return;
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
    if (isClientReady(client)) {
        try {
            const acquired = await client.set(lockKey, '1', 'NX', 'EX', 10);
            if (!acquired) {
                const delays = [200, 500, 1000];
                for (const delay of delays) {
                    await new Promise(r => setTimeout(r, delay));
                    data = await getCache(key);
                    if (data !== null) return data;
                }
            }
        } catch (e) {
            // Redis unavailable — skip locking and fetch directly
        }
    }
    
    data = await fetcher();
    if (data !== null && data !== undefined) {
        await setCache(key, data, ttlInSeconds);
    }
    
    if (isClientReady(client)) {
        try { await client.del(lockKey); } catch (e) {}
    }
    return data;
};

// In-memory locks fallback when Redis is unavailable
const memoryLocks = new Map();

/**
 * @desc Acquire a distributed lock for background jobs or allocation
 */
const acquireLock = async (lockKey, ttlInSeconds = 50) => {
    const holderId = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
    const client = getRedis();
    if (isClientReady(client)) {
        try {
            const acquired = await client.set(`lock:${lockKey}`, holderId, 'NX', 'EX', ttlInSeconds);
            return acquired ? holderId : false;
        } catch (e) {
            // Redis error during command — fallback to in-memory lock
        }
    }

    // In-memory fallback lock (for local dev, tests, or when Redis is offline)
    const existing = memoryLocks.get(lockKey);
    const now = Date.now();
    if (existing && existing.expiresAt > now) {
        return false; // Still locked
    }
    memoryLocks.set(lockKey, { holderId, expiresAt: now + (ttlInSeconds * 1000) });
    return holderId;
};

/**
 * @desc Release a distributed lock (only if owned by this holder)
 */
const releaseLock = async (lockKey, holderId) => {
    const client = getRedis();
    if (isClientReady(client)) {
        try {
            if (holderId) {
                const luaScript = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
                await client.eval(luaScript, 1, `lock:${lockKey}`, holderId);
            } else {
                await client.del(`lock:${lockKey}`);
            }
        } catch (e) {}
    }

    // In-memory fallback release
    const existing = memoryLocks.get(lockKey);
    if (existing) {
        if (!holderId || existing.holderId === holderId) {
            memoryLocks.delete(lockKey);
        }
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
