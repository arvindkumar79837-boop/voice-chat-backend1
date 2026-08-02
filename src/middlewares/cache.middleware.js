// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/middlewares/cache.middleware.js
// ARVIND PARTY - REDIS CACHE MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

const { getRedisClient } = require('../config/redis');
const Logger = require('../utils/logger');

/**
 * Cache middleware for GET requests
 * @param {string} keyPrefix - Cache key prefix
 * @param {number} ttl - Cache TTL in seconds (default: 300)
 */
const cacheMiddleware = (keyPrefix, ttl = 300) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next();

    const redis = getRedisClient();
    if (!redis) return next();

    const key = `${keyPrefix}:${req.originalUrl}`;

    try {
      // Check cache
      const cached = await redis.get(key);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }

      // Store original send
      const originalSend = res.json.bind(res);
      res.json = (body) => {
        redis.set(key, JSON.stringify(body), { EX: ttl })
          .catch(err => Logger.error('Cache set error:', err));
        res.setHeader('X-Cache', 'MISS');
        return originalSend(body);
      };

      next();
    } catch (error) {
      Logger.error('Cache middleware error:', error);
      next();
    }
  };
};

/**
 * Invalidate cache for a key pattern
 * @param {string} pattern - Cache key pattern
 */
const invalidateCache = async (pattern) => {
  try {
    const redis = getRedisClient();
    if (!redis) return;

    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
      Logger.info(`Invalidated ${keys.length} cache keys matching: ${pattern}`);
    }
  } catch (error) {
    Logger.error('Cache invalidation error:', error);
  }
};

/**
 * Cache-aside pattern helper
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to fetch data if cache miss
 * @param {number} ttl - Cache TTL in seconds
 */
const cacheAside = async (key, fetchFn, ttl = 300) => {
  try {
    const redis = getRedisClient();
    if (!redis) return await fetchFn();

    // Check cache
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch data
    const data = await fetchFn();

    // Store in cache
    await redis.set(key, JSON.stringify(data), { EX: ttl });

    return data;
  } catch (error) {
    Logger.error('Cache-aside error:', error);
    return await fetchFn();
  }
};

module.exports = {
  cacheMiddleware,
  invalidateCache,
  cacheAside
};