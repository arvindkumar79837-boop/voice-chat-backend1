/**
 * Arvind Party - Redis Configuration
 */

const redis = require('redis');

let redisClient = null;
let fallbackRedisClient = null;

const connectRedis = async () => {
  try {
    let clientConfig = {};

    // Primary: Railway Redis URL (REDIS_URL) with dual-fallback broken into host/port/password
    if (process.env.REDIS_URL) {
      const url = new URL(process.env.REDIS_URL);
      clientConfig = {
        socket: {
          host: url.hostname,
          port: parseInt(url.port),
          reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
        },
        password: url.password || undefined,
        database: parseInt((url.pathname || '/0').replace('/', '0'))
      };
    } else if (process.env.REDIS_HOST) {
      // Secondary: Explicit host-based config
      clientConfig = {
        socket: {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || '6379'),
          reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
        },
        password: process.env.REDIS_PASSWORD || undefined,
        database: parseInt(process.env.REDIS_DB || '0')
      };
    } else {
      // Fallback: Localhost
      clientConfig = {
        socket: {
          host: '127.0.0.1',
          port: 6379,
          reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
        }
      };
    }

    redisClient = redis.createClient(clientConfig);

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