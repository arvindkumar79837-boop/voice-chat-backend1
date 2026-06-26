/**
 * Arvind Party - Redis Configuration
 */

const redis = require('redis');

let redisClient = null;

const connectRedis = async () => {
  try {
    redisClient = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
      },
      password: process.env.REDIS_PASSWORD || undefined,
      database: parseInt(process.env.REDIS_DB || '0')
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis Client Error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('🔄 Redis Client Connected');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis Client Ready');
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis Client Reconnecting...');
    });

    redisClient.on('end', () => {
      console.log('⚠️ Redis Client Disconnected');
    });

    await redisClient.connect();
    console.log('✅ Redis Connected Successfully');
    return true;
  } catch (error) {
    console.error('⚠️ Redis Connection Failed:', error.message);
    console.log('⚠️ Server will continue running without Redis cache');
    return false;
  }
};

const getRedisClient = () => redisClient;

const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    console.log('📴 Redis Connection Closed');
  }
};

process.on('SIGINT', async () => {
  await disconnectRedis();
  process.exit(0);
});

module.exports = { connectRedis, getRedisClient, disconnectRedis };