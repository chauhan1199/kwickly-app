const { getRedis } = require('./src/helpers/redis.helper');

(async () => {
    const redisClient = getRedis();
    if (redisClient) {
        await redisClient.flushall();
        console.log('Redis cache flushed globally.');
    } else {
        console.log('Redis client not found.');
    }
    process.exit(0);
})();
