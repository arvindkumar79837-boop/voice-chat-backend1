// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/middlewares/security.middleware.js
// ARVIND PARTY - CENTRALIZED SECURITY MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

const xss = require('xss');
const mongoSanitize = require('express-mongo-sanitize');
const { body, query, param } = require('express-validator');
const AppError = require('../utils/AppError');
const Logger = require('../utils/logger');
const BannedDevice = require('../models/BannedDevice');
const { checkIpInfo } = require('../services/ip.service');

// ─── XSS SANITIZATION MIDDLEWARE ──────────────────────────────────────────

/**
 * Sanitizes all string inputs in req.body, req.query, req.params to prevent XSS.
 * Should be applied globally before route handlers.
 */
const sanitizeInput = (req, res, next) => {
  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (typeof obj[key] === 'string') {
          obj[key] = xss(obj[key], {
            whiteList: {}, // No HTML tags allowed
            stripIgnoreTag: true,
            stripIgnoreTagBody: ['script']
          });
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    }
  };

  try {
    sanitizeObject(req.body);
    sanitizeObject(req.query);
    sanitizeObject(req.params);
    next();
  } catch (error) {
    Logger.error('[Sanitization] Error sanitizing input:', error);
    next(new AppError('Invalid input data', 400));
  }
};

// ─── MongoDB INJECTION PREVENTION ─────────────────────────────────────────

/**
 * Removes MongoDB operators ($where, $regex, $gt, $lt, etc.) from request objects.
 * Prevents NoSQL injection attacks.
 * Should be applied globally.
 */
const preventNoSQLInjection = (req, res, next) => {
  const sanitizeMongo = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (key.startsWith('$')) {
          delete obj[key];
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeMongo(obj[key]);
        }
      }
    }
  };

  try {
    sanitizeMongo(req.body);
    sanitizeMongo(req.query);
    sanitizeMongo(req.params);
    next();
  } catch (error) {
    Logger.error('[NoSQL Injection] Error sanitizing input:', error);
    next(new AppError('Invalid input data', 400));
  }
};

// ─── PROTOTYPE POLLUTION PREVENTION ───────────────────────────────────────

/**
 * Blocks requests that attempt to pollute Object.prototype
 * by setting dangerous properties like __proto__, constructor, prototype.
 */
const preventPrototypePollution = (req, res, next) => {
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  
  const checkObject = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (dangerousKeys.includes(key)) {
          return true;
        }
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (checkObject(obj[key])) return true;
        }
      }
    }
    return false;
  };

  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    Logger.warn('[Prototype Pollution] Blocked attempt:', {
      body: req.body,
      query: req.query,
      params: req.params,
      ip: req.ip
    });
    return res.status(400).json({
      success: false,
      message: 'Invalid request parameters',
      code: 'INVALID_PARAMETERS'
    });
  }

  next();
};

// ─── HTTP PARAMETER POLLUTION PREVENTION ──────────────────────────────────

/**
 * Prevents HTTP Parameter Pollution by ensuring only the first value
 * of duplicate query parameters is used.
 */
const preventHTTPParameterPollution = (req, res, next) => {
  if (req.query && typeof req.query === 'object') {
    const sanitizedQuery = {};
    for (const key in req.query) {
      if (Object.prototype.hasOwnProperty.call(req.query, key)) {
        const value = req.query[key];
        sanitizedQuery[key] = Array.isArray(value) ? value[0] : value;
      }
    }
    req.query = sanitizedQuery;
  }
  next();
};

// ─── CONTENT-TYPE VALIDATION ──────────────────────────────────────────────

/**
 * Validates that requests with bodies have the correct Content-Type header.
 */
const validateContentType = (allowedTypes = ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data']) => {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE') {
      return next();
    }

    const contentType = req.headers['content-type'];
    if (!contentType) {
      return res.status(400).json({
        success: false,
        message: 'Content-Type header is required',
        code: 'MISSING_CONTENT_TYPE'
      });
    }

    const baseContentType = contentType.split(';')[0].trim();
    if (!allowedTypes.includes(baseContentType)) {
      return res.status(415).json({
        success: false,
        message: `Unsupported Content-Type: ${baseContentType}. Allowed: ${allowedTypes.join(', ')}`,
        code: 'UNSUPPORTED_CONTENT_TYPE'
      });
    }

    next();
  };
};

// ─── BODY SIZE LIMITS ─────────────────────────────────────────────────────

/**
 * Returns middleware to enforce body size limits.
 */
const bodyLimit = (limit = '100kb') => {
  return (req, res, next) => {
    const contentLength = req.headers['content-length'];
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength, 10);
      const limitInBytes = typeof limit === 'string' 
        ? parseInt(limit, 10) 
        : limit;
      
      if (sizeInBytes > limitInBytes) {
        return res.status(413).json({
          success: false,
          message: `Request body too large. Maximum size: ${limit}`,
          code: 'BODY_TOO_LARGE'
        });
      }
    }
    next();
  };
};

// ─── FILE UPLOAD VALIDATION ───────────────────────────────────────────────

/**
 * Validates uploaded files for security.
 * @param {Object} options - Validation options
 * @param {string[]} options.allowedMimeTypes - Array of allowed MIME types
 * @param {number} options.maxSize - Maximum file size in bytes
 * @param {string[]} options.allowedExtensions - Array of allowed file extensions
 */
const validateFileUpload = (options = {}) => {
  const {
    allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp']
  } = options;

  return (req, res, next) => {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
    
    for (const file of files) {
      if (!file) continue;

      // Check file size
      if (file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: `File ${file.originalname} exceeds maximum size of ${maxSize / 1024 / 1024}MB`,
          code: 'FILE_TOO_LARGE'
        });
      }

      // Check MIME type
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: `File ${file.originalname} has invalid type. Allowed: ${allowedMimeTypes.join(', ')}`,
          code: 'INVALID_FILE_TYPE'
        });
      }

      // Check file extension
      const extension = file.originalname.split('.').pop().toLowerCase();
      if (!allowedExtensions.includes(extension)) {
        return res.status(400).json({
          success: false,
          message: `File ${file.originalname} has invalid extension. Allowed: ${allowedExtensions.join(', ')}`,
          code: 'INVALID_FILE_EXTENSION'
        });
      }

      // Check for double extensions (e.g., file.jpg.php)
      const extCount = file.originalname.match(/\./g)?.length || 0;
      if (extCount > 1) {
        return res.status(400).json({
          success: false,
          message: `File ${file.originalname} has multiple extensions`,
          code: 'INVALID_FILE_NAME'
        });
      }
    }

    next();
  };
};

// ─── NETWORK LOCKDOWN (Device & IP Checks) ────────────────────────────────

/**
 * Performs security checks for device ID and IP address.
 */
const networkLockdown = async (req, res, next) => {
  try {
    const deviceId = req.headers['x-device-id'];

    if (deviceId) {
      const isBanned = await BannedDevice.findOne({ deviceId });
      if (isBanned) {
        Logger.warn(`[Security] Blocked request from banned device ID: ${deviceId}`);
        return res.status(403).json({
          success: false,
          code: 'DEVICE_BANNED',
          message: 'This device has been permanently blocked from accessing the service due to severe policy violations.',
        });
      }
    }

    const ipAddress = req.ip;
    const ipInfo = await checkIpInfo(ipAddress);
    req.ipInfo = ipInfo;

    if (ipInfo.isVpn) {
      Logger.warn(`[Security] Blocked VPN request from IP: ${ipAddress} (${ipInfo.country})`);
      return res.status(403).json({
        success: false,
        code: 'VPN_DETECTED',
        message: 'Access via VPNs, proxies, or anonymous networks is not permitted. Please disable your VPN and try again.',
      });
    }

    next();
  } catch (error) {
    Logger.error('[Security Middleware] An unexpected error occurred:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal security check failed. Please try again later.'
    });
  }
};

// ─── SQL INJECTION PREVENTION (for any raw queries) ──────────────────────

/**
 * Validates that query parameters don't contain SQL injection patterns.
 * This is a basic check - use parameterized queries for actual SQL.
 */
const preventSQLInjection = (req, res, next) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(UNION\s+SELECT)/i,
    /(\bOR\b\s+\d+\s*=\s*\d+)/i,
    /(\bAND\b\s+\d+\s*=\s*\d+)/i,
    /('|"|;|--|\/\*|\*\/|xp_|sp_)/i
  ];

  const checkString = (str) => {
    if (typeof str !== 'string') return false;
    return sqlPatterns.some(pattern => pattern.test(str));
  };

  const checkObject = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (checkString(obj[key])) return true;
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (checkObject(obj[key])) return true;
        }
      }
    }
    return false;
  };

  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    Logger.warn('[SQL Injection] Blocked suspicious input:', {
      body: req.body,
      query: req.query,
      params: req.params,
      ip: req.ip
    });
    return res.status(400).json({
      success: false,
      message: 'Invalid input detected',
      code: 'INVALID_INPUT'
    });
  }

  next();
};

module.exports = {
  sanitizeInput,
  preventNoSQLInjection,
  preventPrototypePollution,
  preventHTTPParameterPollution,
  validateContentType,
  bodyLimit,
  validateFileUpload,
  networkLockdown,
  preventSQLInjection
};