// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/utils/jwt.js
// ARVIND PARTY — JWT Access Token + Refresh Token Engine
// Access Token: 15 min | Refresh Token: 30 days
// ═══════════════════════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_EXPIRY  = '15m';
const REFRESH_TOKEN_EXPIRY = '30d';
const TOKEN_BLACKLIST_PREFIX = 'blacklist:';

/**
 * Generate a short-lived Access Token (15 minutes).
 * Used for every API call.
 */
const generateAccessToken = (payload) => {
  return jwt.sign(
    { id: payload.id, role: payload.role, uid: payload.uid },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

/**
 * Generate a long-lived Refresh Token (30 days).
 * Stored server-side in Redis / DB for rotation & revocation.
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(
    { id: payload.id, uid: payload.uid },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
};

/**
 * Verify an Access Token.
 * Returns decoded payload or throws.
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

/**
 * Verify a Refresh Token.
 * Returns decoded payload or throws.
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
};

/**
 * Blacklist an access token by storing its jti (or token itself) in Redis with TTL.
 * After blacklisting, even if not expired, the token will be rejected.
 */
const blacklistAccessToken = async (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.jti) return false;
    // TTL: match the remaining time until expiry
    const ttl = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
    if (ttl <= 0) return false;
    const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
    const redis = require('redis');
    const client = redis.createClient({ url: redisUrl, password: process.env.REDIS_PASSWORD || undefined });
    await client.connect();
    await client.setEx(`${TOKEN_BLACKLIST_PREFIX}${decoded.jti}`, ttl, '1');
    await client.quit();
    return true;
  } catch {
    return false;
  }
};

/**
 * Check if an access token is blacklisted.
 */
const isTokenBlacklisted = async (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.jti) return false;
    const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
    const redis = require('redis');
    const client = redis.createClient({ url: redisUrl, password: process.env.REDIS_PASSWORD || undefined });
    await client.connect();
    const exists = await client.exists(`${TOKEN_BLACKLIST_PREFIX}${decoded.jti}`);
    await client.quit();
    return exists === 1;
  } catch {
    return false;
  }
};

/**
 * Legacy helper kept for backward-compatible usage in older controllers.
 * Emits an access token with extended 30-day expiry (for routes not yet migrated).
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateToken,
  blacklistAccessToken,
  isTokenBlacklisted,
};
