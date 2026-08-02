// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/middlewares/socketSecurity.middleware.js
// ARVIND PARTY - SOCKET SECURITY MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

const Logger = require('../utils/logger');
const { getRedisClient } = require('../config/redis');

/**
 * Rate limiting configuration for socket events
 */
const RATE_LIMITS = {
  chat: { windowMs: 3000, max: 1, key: 'chat' }, // 1 message per 3 seconds
  reaction: { windowMs: 1000, max: 3, key: 'reaction' }, // 3 reactions per second
  typing: { windowMs: 2000, max: 1, key: 'typing' }, // 1 typing event per 2 seconds
  gift: { windowMs: 2000, max: 1, key: 'gift' }, // 1 gift per 2 seconds
  combo_gift: { windowMs: 5000, max: 1, key: 'combo_gift' }, // 1 combo per 5 seconds
  youtube_toggle: { windowMs: 1000, max: 5, key: 'youtube_toggle' }, // 5 toggles per second
  youtube_seek: { windowMs: 500, max: 10, key: 'youtube_seek' }, // 10 seeks per 0.5 seconds
  youtube_change: { windowMs: 3000, max: 1, key: 'youtube_change' } // 1 video change per 3 seconds
};

/**
 * Check rate limit using Redis
 * @param {string} userId - User ID
 * @param {string} action - Action type
 * @returns {boolean} - True if allowed, false if rate limited
 */
const checkRateLimit = async (userId, action) => {
  try {
    const redis = getRedisClient();
    if (!redis) return true; // Skip rate limiting if Redis unavailable

    const config = RATE_LIMITS[action];
    if (!config) return true;

    const key = `rate_limit:${config.key}:${userId}`;
    const current = await redis.get(key);

    if (current && parseInt(current) >= config.max) {
      return false;
    }

    // Increment counter
    await redis.multi()
      .incr(key)
      .expire(key, Math.ceil(config.windowMs / 1000))
      .exec();

    return true;
  } catch (error) {
    Logger.error('Rate limit check error:', error);
    return true; // Allow on error to prevent blocking
  }
};

/**
 * Create rate limiter middleware for socket events
 * @param {string} action - Action type for rate limiting
 * @returns {Function} Socket middleware
 */
const rateLimiter = (action) => {
  return async (socket, next) => {
    const userId = socket.data?.userId;
    if (!userId) {
      return next(new Error('Authentication required'));
    }

    const allowed = await checkRateLimit(userId, action);
    if (!allowed) {
      return next(new Error(`Rate limit exceeded for ${action}. Please slow down.`));
    }

    next();
  };
};

/**
 * Validate socket event data
 * @param {Object} schema - Validation schema
 * @returns {Function} Socket middleware
 */
const validateSocketData = (schema) => {
  return (socket, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = socket.data?.[field];

      if (rules.required && !value) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value && rules.type && typeof value !== rules.type) {
        errors.push(`${field} must be ${rules.type}`);
      }

      if (value && rules.minLength && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }

      if (value && rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters`);
      }

      if (value && rules.min !== undefined && value < rules.min) {
        errors.push(`${field} must be at least ${rules.min}`);
      }

      if (value && rules.max !== undefined && value > rules.max) {
        errors.push(`${field} must be at most ${rules.max}`);
      }
    }

    if (errors.length > 0) {
      return next(new Error(errors.join(', ')));
    }

    next();
  };
};

/**
 * Clean up user presence on disconnect
 * @param {Object} io - Socket.IO instance
 * @param {Object} socket - Socket instance
 */
const cleanupOnDisconnect = async (io, socket) => {
  try {
    const userId = socket.data?.userId;
    if (!userId) return;

    // Get all rooms the user was in
    const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);

    // Leave all rooms
    for (const roomId of rooms) {
      socket.leave(roomId);
      
      // Notify others in the room
      io.to(roomId).emit('user_left', {
        userId,
        message: 'User disconnected',
        timestamp: new Date()
      });
    }

    // Clear presence from Redis
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`presence:${userId}`);
      await redis.srem('online_users', userId);
    }

    Logger.info(`Cleaned up presence for user ${userId}`);
  } catch (error) {
    Logger.error('Disconnect cleanup error:', error);
  }
};

/**
 * Track user presence in Redis
 * @param {string} userId - User ID
 * @param {string} roomId - Room ID
 */
const trackPresence = async (userId, roomId) => {
  try {
    const redis = getRedisClient();
    if (!redis) return;

    const key = `presence:${userId}`;
    await redis.hset(key, {
      roomId,
      lastSeen: new Date().toISOString(),
      status: 'online'
    });

    await redis.expire(key, 300); // 5 minutes TTL
    await redis.sadd('online_users', userId);
  } catch (error) {
    Logger.error('Presence tracking error:', error);
  }
};

/**
 * Prevent duplicate event handlers
 * @param {Object} socket - Socket instance
 * @param {string} eventName - Event name
 * @param {Function} handler - Event handler
 */
const on = (socket, eventName, handler) => {
  // Remove existing handler if present
  socket.removeAllListeners(eventName);
  // Add new handler
  socket.on(eventName, handler);
};

module.exports = {
  RATE_LIMITS,
  checkRateLimit,
  rateLimiter,
  validateSocketData,
  cleanupOnDisconnect,
  trackPresence,
  on
};