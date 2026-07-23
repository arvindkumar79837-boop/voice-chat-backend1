const Logger = require('../utils/logger');
/**
 * Arvind Party - Redis Configuration
 */

const redis = require('redis');
const MonitoringService = require('../services/monitoringService');

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

    // Add connection timeout to prevent infinite hang
    const connectPromise = redisClient.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Redis connection timeout after 5s')), 5000)
    );
    
    redisClient.on('error', (err) => {
      MonitoringService.updateRedisStatus(false);
      Logger.error('❌ Redis Client Error:', err.message);
    });

    redisClient.on('connect', () => {
      MonitoringService.updateRedisStatus(true);
      Logger.info('🔄 Redis Client Connected');
    });

    redisClient.on('ready', () => {
      MonitoringService.updateRedisStatus(true);
      Logger.info('✅ Redis Client Ready');
    });

    redisClient.on('reconnecting', () => {
      Logger.info('🔄 Redis Client Reconnecting...');
    });

    redisClient.on('end', () => {
      MonitoringService.updateRedisStatus(false);
      Logger.info('⚠️ Redis Client Disconnected');
    });

    await Promise.race([connectPromise, timeoutPromise]);
    Logger.info('✅ Redis Connected Successfully');
    return true;
  } catch (error) {
    Logger.error('⚠️ Redis Connection Failed:', error.message);
    Logger.info('⚠️ Server will continue running without Redis cache');
    return false;
  }
};

const getRedisClient = () => redisClient;

const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    Logger.info('📴 Redis Connection Closed');
  }
};

module.exports = { connectRedis, getRedisClient, disconnectRedis };