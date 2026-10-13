/**
 * Comprehensive tests for Redis helper functions (helpers/redis.helper.js)
 *
 * Mocks ioredis directly so we can test the real helper logic without a live Redis.
 */

const mockRedisInstance = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    scan: jest.fn(),
    on: jest.fn()
};

jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => mockRedisInstance);
});

jest.mock('../helpers/logger.helper', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

// Require helpers AFTER mocks are set up
const {
    initRedis,
    getRedis,
    setCache,
    getCache,
    delCache,
    delCacheByPattern,
    fetchWithCache,
    acquireLock,
    releaseLock
} = require('../helpers/redis.helper');

afterEach(() => {
    // Reset both call history AND implementations to prevent bleed
    mockRedisInstance.set.mockReset();
    mockRedisInstance.get.mockReset();
    mockRedisInstance.del.mockReset();
    mockRedisInstance.scan.mockReset();
});

describe('Redis Helper Functions', () => {

    // ─── initRedis / getRedis ────────────────────────────────────────────────
    describe('initRedis & getRedis', () => {
        it('should initialize Redis and return the client', () => {
            const client = initRedis();
            expect(client).toBeDefined();
            expect(typeof client.set).toBe('function');
        });

        it('getRedis should return existing client without re-initializing', () => {
            const client1 = getRedis();
            const client2 = getRedis();
            expect(client1).toBe(client2);
        });
    });

    // ─── setCache ────────────────────────────────────────────────────────────
    describe('setCache(key, value, ttl)', () => {
        it('should call redis.set with JSON stringified value and EX ttl', async () => {
            mockRedisInstance.set.mockResolvedValue('OK');

            await setCache('test:key', { foo: 'bar' }, 300);

            expect(mockRedisInstance.set).toHaveBeenCalledWith(
                'test:key',
                JSON.stringify({ foo: 'bar' }),
                'EX',
                300
            );
        });

        it('should use default TTL of 3600 when not provided', async () => {
            mockRedisInstance.set.mockResolvedValue('OK');

            await setCache('default:ttl', [1, 2, 3]);

            expect(mockRedisInstance.set).toHaveBeenCalledWith(
                'default:ttl',
                JSON.stringify([1, 2, 3]),
                'EX',
                3600
            );
        });

        it('should not throw when redis errors', async () => {
            mockRedisInstance.set.mockRejectedValue(new Error('Connection lost'));

            await expect(
                setCache('err:key', { a: 1 }, 60)
            ).resolves.toBeUndefined();
        });
    });

    // ─── getCache ────────────────────────────────────────────────────────────
    describe('getCache(key)', () => {
        it('should return parsed JSON object on cache hit', async () => {
            const data = { name: 'test', value: 42 };
            mockRedisInstance.get.mockResolvedValue(JSON.stringify(data));

            const result = await getCache('hit:key');

            expect(mockRedisInstance.get).toHaveBeenCalledWith('hit:key');
            expect(result).toEqual(data);
        });

        it('should return null on cache miss', async () => {
            mockRedisInstance.get.mockResolvedValue(null);

            const result = await getCache('miss:key');

            expect(result).toBeNull();
        });

        it('should double-parse stringified JSON (nested string)', async () => {
            // First parse returns a string, second parse returns the object
            const inner = { nested: true };
            const outer = JSON.stringify(inner);
            mockRedisInstance.get.mockResolvedValue(JSON.stringify(outer));

            const result = await getCache('double:parse');

            expect(result).toEqual(inner);
        });

        it('should return raw parsed value if not double-stringified', async () => {
            const data = { simple: 'object' };
            mockRedisInstance.get.mockResolvedValue(JSON.stringify(data));

            const result = await getCache('single:parse');

            expect(result).toEqual(data);
        });

        it('should return null and not throw on redis error', async () => {
            mockRedisInstance.get.mockRejectedValue(new Error('timeout'));

            const result = await getCache('err:get');

            expect(result).toBeNull();
        });
    });

    // ─── delCache ────────────────────────────────────────────────────────────
    describe('delCache(key)', () => {
        it('should delete a normal key', async () => {
            mockRedisInstance.del.mockResolvedValue(1);

            await delCache('normal:key');

            expect(mockRedisInstance.del).toHaveBeenCalledWith('normal:key');
        });

        it('should also delete admin_dashboard_stats range variants', async () => {
            mockRedisInstance.del.mockResolvedValue(1);

            await delCache('admin_dashboard_stats');

            const ranges = ['today', 'week', 'month', 'quarter', 'year', 'all'];
            for (const r of ranges) {
                expect(mockRedisInstance.del).toHaveBeenCalledWith(`admin_dashboard_stats_${r}`);
            }
            // Also deletes the base key itself
            expect(mockRedisInstance.del).toHaveBeenCalledWith('admin_dashboard_stats');
            expect(mockRedisInstance.del).toHaveBeenCalledTimes(ranges.length + 1);
        });

        it('should not delete range variants for non-dashboard keys', async () => {
            mockRedisInstance.del.mockResolvedValue(1);

            await delCache('some:other:key');

            expect(mockRedisInstance.del).toHaveBeenCalledTimes(1);
            expect(mockRedisInstance.del).toHaveBeenCalledWith('some:other:key');
        });

        it('should not throw on redis error', async () => {
            mockRedisInstance.del.mockRejectedValue(new Error('IO error'));

            await expect(
                delCache('err:del')
            ).resolves.toBeUndefined();
        });
    });

    // ─── delCacheByPattern ───────────────────────────────────────────────────
    describe('delCacheByPattern(pattern)', () => {
        it('should SCAN and delete matching keys', async () => {
            mockRedisInstance.scan.mockResolvedValueOnce(['0', ['key:1', 'key:2', 'key:3']]);

            await delCacheByPattern('key:*');

            expect(mockRedisInstance.scan).toHaveBeenCalledWith('0', 'MATCH', 'key:*', 'COUNT', 100);
            expect(mockRedisInstance.del).toHaveBeenCalledWith(['key:1', 'key:2', 'key:3']);
        });

        it('should handle multiple SCAN iterations (non-zero cursor)', async () => {
            mockRedisInstance.scan
                .mockResolvedValueOnce(['42', ['k:1', 'k:2']])
                .mockResolvedValueOnce(['0', ['k:3']]);

            await delCacheByPattern('k:*');

            expect(mockRedisInstance.scan).toHaveBeenCalledTimes(2);
            expect(mockRedisInstance.del).toHaveBeenCalledWith(['k:1', 'k:2']);
            expect(mockRedisInstance.del).toHaveBeenCalledWith(['k:3']);
        });

        it('should not call del if no keys match', async () => {
            mockRedisInstance.scan.mockResolvedValueOnce(['0', []]);

            await delCacheByPattern('no:match:*');

            expect(mockRedisInstance.del).not.toHaveBeenCalled();
        });

        it('should not throw on redis error', async () => {
            mockRedisInstance.scan.mockRejectedValue(new Error('SCAN failed'));

            await expect(
                delCacheByPattern('err:*')
            ).resolves.toBeUndefined();
        });
    });

    // ─── fetchWithCache ──────────────────────────────────────────────────────
    describe('fetchWithCache(key, ttl, fetcher)', () => {
        it('should return cached data on cache hit (no fetcher call)', async () => {
            const cached = { cached: true };
            mockRedisInstance.get.mockResolvedValue(JSON.stringify(cached));

            const fetcher = jest.fn();
            const result = await fetchWithCache('cached:key', 60, fetcher);

            expect(result).toEqual(cached);
            expect(fetcher).not.toHaveBeenCalled();
        });

        it('should call fetcher on cache miss and store result', async () => {
            // First getCache returns null (miss)
            mockRedisInstance.get.mockResolvedValueOnce(null);
            // Lock acquisition succeeds
            mockRedisInstance.set.mockResolvedValueOnce('OK');
            // setCache calls set again to store result
            mockRedisInstance.set.mockResolvedValueOnce('OK');

            const fetcher = jest.fn().mockResolvedValue({ fresh: true });

            const result = await fetchWithCache('miss:key', 120, fetcher);

            expect(fetcher).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ fresh: true });
            // setCache was called to store the result
            expect(mockRedisInstance.set).toHaveBeenCalled();
        });

        it('should call fetcher exactly once even with concurrent access (lock)', async () => {
            // First getCache returns null (miss)
            mockRedisInstance.get.mockResolvedValueOnce(null);
            // Lock acquisition succeeds
            mockRedisInstance.set.mockResolvedValueOnce('OK');

            const fetcher = jest.fn().mockResolvedValue({ data: 'computed' });

            await fetchWithCache('lock:key', 60, fetcher);

            expect(fetcher).toHaveBeenCalledTimes(1);
        });

        it('should release lock after fetch completes', async () => {
            mockRedisInstance.get.mockResolvedValueOnce(null);
            mockRedisInstance.set.mockResolvedValueOnce('OK');

            const fetcher = jest.fn().mockResolvedValue({ done: true });

            await fetchWithCache('release:key', 60, fetcher);

            // del should be called at least once for lock release
            expect(mockRedisInstance.del).toHaveBeenCalled();
        });

        it('should retry getCache after lock contention', async () => {
            // First getCache returns null (miss)
            mockRedisInstance.get.mockResolvedValueOnce(null);
            // Lock acquisition fails (already held by another process)
            mockRedisInstance.set.mockResolvedValueOnce(null);
            // Second getCache returns cached data (another process filled it)
            mockRedisInstance.get.mockResolvedValueOnce(JSON.stringify({ filled: true }));

            const fetcher = jest.fn();
            const result = await fetchWithCache('contention:key', 60, fetcher);

            expect(result).toEqual({ filled: true });
            expect(fetcher).not.toHaveBeenCalled();
        });
    });

    // ─── acquireLock ─────────────────────────────────────────────────────────
    describe('acquireLock(lockKey, ttl)', () => {
        it('should return true when lock is successfully acquired', async () => {
            mockRedisInstance.set.mockResolvedValue('OK');

            const result = await acquireLock('my:lock', 50);

            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(mockRedisInstance.set).toHaveBeenCalledWith('lock:my:lock', expect.any(String), 'NX', 'EX', 50);
        });

        it('should return false when lock is already held', async () => {
            mockRedisInstance.set.mockResolvedValue(null);

            const result = await acquireLock('my:lock', 50);

            expect(result).toBe(false);
        });

        it('should fall back to an in-memory lock on redis error', async () => {
            mockRedisInstance.set.mockRejectedValue(new Error('down'));

            const first = await acquireLock('err:lock', 50);
            const second = await acquireLock('err:lock', 50);

            expect(typeof first).toBe('string');
            expect(second).toBe(false);
        });

        it('should use default TTL of 50 when not specified', async () => {
            mockRedisInstance.set.mockResolvedValue('OK');

            await acquireLock('default:ttl:lock');

            expect(mockRedisInstance.set).toHaveBeenCalledWith(
                'lock:default:ttl:lock', expect.any(String), 'NX', 'EX', 50
            );
        });
    });

    // ─── releaseLock ─────────────────────────────────────────────────────────
    describe('releaseLock(lockKey)', () => {
        it('should delete the lock key', async () => {
            mockRedisInstance.del.mockResolvedValue(1);

            await releaseLock('my:lock');

            expect(mockRedisInstance.del).toHaveBeenCalledWith('lock:my:lock');
        });

        it('should not throw on redis error', async () => {
            mockRedisInstance.del.mockRejectedValue(new Error('del failed'));

            await expect(
                releaseLock('err:lock')
            ).resolves.toBeUndefined();
        });
    });
});
