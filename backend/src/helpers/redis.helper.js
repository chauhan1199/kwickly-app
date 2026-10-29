const Redis = require('ioredis');
const logger = require('./logger.helper');

let redis = null;
let connectionAttempts = 0;
const MAX_LOG_ATTEMPTS = 3;

// ─── Circuit Breaker for Redis Latency & Quota Failures ──────────────────────
let isCircuitOpen = false;
let circuitResetAt = 0;
let circuitReason = '';

const tripCircuit = (reason, cooldownSeconds = 60) => {
    isCircuitOpen = true;
    circuitResetAt = Date.now() + (cooldownSeconds * 1000);
    if (circuitReason !== reason) {
        circuitReason = reason;
        logger.warn(`[Redis Circuit Breaker] Tripped: ${reason}. Bypassing remote Redis and serving from in-memory cache for ${cooldownSeconds}s.`);
    }
};

const checkCircuit = () => {
    if (!isCircuitOpen) return false;
    if (Date.now() > circuitResetAt) {
        // Probe period: allow one attempt to test if Redis is restored
        isCircuitOpen = false;
        circuitReason = '';
        logger.info('[Redis Circuit Breaker] Resetting circuit breaker. Testing Redis connectivity.');
        return false;
    }
    return true; // Circuit remains open
};

const handleRedisError = (error) => {
    const msg = error?.message || '';
    const code = error?.code || '';
    if (msg.includes('max requests limit exceeded')) {
        tripCircuit('Upstash quota exceeded (500k monthly limit reached)', 600); // 10 min
    } else if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT') {
        tripCircuit(`Connection failure (${code})`, 60);
    } else {
        tripCircuit(msg || 'Redis command error', 30);
    }
};

/**
 * @desc Initialize Redis connection with graceful retry strategy
 */
const initRedis = () => {
    try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        
        redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 1,
            connectTimeout: 2000,
            enableOfflineQueue: false,
            retryStrategy(times) {
                connectionAttempts++;
                if (times > 3) {
                    if (connectionAttempts === MAX_LOG_ATTEMPTS + 1) {
                        logger.warn('Redis connection failed after multiple attempts. Operating in in-memory fallback.');
                    }
                    tripCircuit('Persistent connection failure', 60);
                    return Math.min(times * 5000, 60000);
                }
                return Math.min(times * 100, 1000);
            }
        });

        redis.on('connect', () => {
            connectionAttempts = 0;
            isCircuitOpen = false;
            circuitReason = '';
            logger.info('Successfully connected to Redis');
        });

        redis.on('error', (error) => {
            handleRedisError(error);
            if (connectionAttempts === 1) {
                logger.warn(`Redis unavailable (${error?.code || error?.message || 'ECONNREFUSED'}). Operating with in-memory fallback.`);
            }
        });

        return redis;
    } catch (error) {
        logger.error('Failed to initialize Redis:', error);
        handleRedisError(error);
        return null;
    }
};

const isClientReady = (client) => {
    if (checkCircuit()) return false;
    if (!client) return false;
    if (client.status === undefined) return true; // Allows mocked redis in unit tests
    return client.status === 'ready';
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

// In-memory cache fallback when Redis is offline or unreachable
const memoryCache = new Map();

/**
 * @desc Set data in cache with TTL
 */
const setCache = async (key, value, ttlInSeconds = 3600) => {
    const client = getRedis();
    if (!isClientReady(client)) {
        memoryCache.set(key, { value, expiresAt: Date.now() + (ttlInSeconds * 1000) });
        return;
    }
    try {
        await client.set(key, JSON.stringify(value), 'EX', ttlInSeconds);
    } catch (error) {
        handleRedisError(error);
        memoryCache.set(key, { value, expiresAt: Date.now() + (ttlInSeconds * 1000) });
    }
};

/**
 * @desc Get data from cache
 */
const getCache = async (key) => {
    const client = getRedis();
    if (!isClientReady(client)) {
        const item = memoryCache.get(key);
        if (!item) return null;
        if (item.expiresAt && item.expiresAt < Date.now()) {
            memoryCache.delete(key);
            return null;
        }
        return item.value;
    }
    try {
        const data = await client.get(key);
        if (!data) return null;
        let parsed = JSON.parse(data);
        if (typeof parsed === 'string' && (parsed.startsWith('{') || parsed.startsWith('['))) {
            try { parsed = JSON.parse(parsed); } catch(e) {}
        }
        return parsed;
    } catch (error) {
        handleRedisError(error);
        const item = memoryCache.get(key);
        if (item && (!item.expiresAt || item.expiresAt >= Date.now())) return item.value;
        return null;
    }
};

/**
 * @desc Atomic increment in cache with TTL
 */
const incrCache = async (key, ttlInSeconds = 3600) => {
    const client = getRedis();
    if (!isClientReady(client)) {
        const item = memoryCache.get(key);
        const current = (item && (!item.expiresAt || item.expiresAt >= Date.now())) ? Number(item.value) || 0 : 0;
        const next = current + 1;
        memoryCache.set(key, { value: next, expiresAt: Date.now() + (ttlInSeconds * 1000) });
        return next;
    }
    try {
        const val = await client.incr(key);
        if (val === 1 && ttlInSeconds) {
            await client.expire(key, ttlInSeconds);
        }
        return val;
    } catch (error) {
        handleRedisError(error);
        const item = memoryCache.get(key);
        const current = (item && (!item.expiresAt || item.expiresAt >= Date.now())) ? Number(item.value) || 0 : 0;
        const next = current + 1;
        memoryCache.set(key, { value: next, expiresAt: Date.now() + (ttlInSeconds * 1000) });
        return next;
    }
};

/**
 * @desc Delete data from cache
 */
const delCache = async (key) => {
    // Delete from memoryCache fallback
    memoryCache.delete(key);
    if (key === 'admin_dashboard_stats') {
        const ranges = ['today', 'week', 'month', 'quarter', 'year', 'all'];
        for (const r of ranges) {
            memoryCache.delete(`admin_dashboard_stats_${r}`);
        }
    }

    const client = getRedis();
    if (!isClientReady(client)) return null;
    try {
        // Automatically handle range suffixes for dashboard stats invalidation
        if (key === 'admin_dashboard_stats') {
            const ranges = ['today', 'week', 'month', 'quarter', 'year', 'all'];
            for (const r of ranges) {
                await client.del(`admin_dashboard_stats_${r}`);
            }
        }
        await client.del(key);
    } catch (error) {
        handleRedisError(error);
    }
};

/**
 * @desc Delete keys matching pattern without blocking using SCAN
 */
const delCacheByPattern = async (pattern) => {
    // Also clear matching keys from memoryCache
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const k of memoryCache.keys()) {
        if (regex.test(k)) memoryCache.delete(k);
    }

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
        handleRedisError(error);
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
            handleRedisError(e);
            // Skip locking and fetch directly
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
            handleRedisError(e);
            // Fallback to in-memory lock below
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
        } catch (e) {
            handleRedisError(e);
        }
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
    incrCache,
    delCache,
    delCacheByPattern,
    fetchWithCache,
    acquireLock,
    releaseLock
};
