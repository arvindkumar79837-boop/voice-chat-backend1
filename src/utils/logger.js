const Logger = require('../utils/logger');
// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/utils/logger.js
// ARVIND PARTY — Structured Logging (Winston)
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// Create logs directory
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

let logger;

try {
  const winston = require('winston');

  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
      winston.format.errors({ stack: true }),
      process.env.NODE_ENV === 'production'
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const extras = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
              return `[${timestamp}] ${level}: ${message}${extras}`;
            })
          )
    ),
    transports: [
      new winston.transports.Console({
        silent: process.env.NODE_ENV === 'test',
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        maxsize: 20 * 1024 * 1024, // 20MB
        maxFiles: 10,
      }),
    ],
    exceptionHandlers: [
      new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log') }),
    ],
    rejectionHandlers: [
      new winston.transports.File({ filename: path.join(logsDir, 'rejections.log') }),
    ],
  });
} catch (e) {
  // Fallback if winston not installed yet
  const noop = () => {};
  logger = {
    info: (msg, meta) => Logger.info(`[INFO] ${msg}`, meta || ''),
    error: (msg, meta) => Logger.error(`[ERROR] ${msg}`, meta || ''),
    warn: (msg, meta) => Logger.warn(`[WARN] ${msg}`, meta || ''),
    debug: (msg, meta) => {
      if (process.env.DEBUG_LOGS === 'true') Logger.info(`[DEBUG] ${msg}`, meta || '');
    },
    http: noop,
  };
}

// Backward-compat static helpers (matches old Logger.info / Logger.error style)
logger.socket = (event, action, userId = null) =>
  logger.debug(`[SOCKET] ${event} - ${action}`, userId ? { userId } : undefined);

logger.api = (action, endpoint, userId = null, result = 'success') => {
  if (process.env.API_LOGS === 'true' || process.env.DEBUG_LOGS === 'true') {
    logger.debug(`[API] ${action} ${endpoint}`, { userId, result });
  }
};

logger.database = (query, duration, success = true) => {
  if (process.env.DB_LOGS === 'true' || process.env.DEBUG_LOGS === 'true') {
    logger.debug(`[DB] ${query} (${duration}ms)`, { success });
  }
};

logger.http = (method, pathStr, statusCode, duration, ip) => {
  if (process.env.HTTP_LOGS === 'true' || process.env.DEBUG_LOGS === 'true') {
    logger.debug(`[HTTP] ${method} ${pathStr} ${statusCode} (${duration}ms)`, { ip });
  }
};

module.exports = logger;
