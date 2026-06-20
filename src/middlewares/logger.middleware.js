// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/middlewares/logger.middleware.js
// ARVIND PARTY - STRUCTURED LOGGER
// ═══════════════════════════════════════════════════════════════════════════

const chalk = require('chalk');

// Simple in-memory log buffer (can be swapped for Winston later)
const logBuffer = [];
const MAX_BUFFER_SIZE = 500; // keep last 500 logs in memory

const log = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level,
    message,
    ...meta
  };

  // Store in memory for debugging
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.shift();
  }

  // Console output with colors
  switch (level) {
    case 'ERROR':
      console.error(chalk.red(`[${timestamp}] ERROR: ${message}`), meta);
      break;
    case 'WARN':
      console.warn(chalk.yellow(`[${timestamp}] WARN: ${message}`), meta);
      break;
    case 'INFO':
      console.log(chalk.cyan(`[${timestamp}] INFO: ${message}`), meta);
      break;
    case 'DEBUG':
      console.log(chalk.gray(`[${timestamp}] DEBUG: ${message}`), meta);
      break;
    default:
      console.log(`[${timestamp}] ${level}: ${message}`, meta);
  }
};

const logger = {
  info: (message, meta) => log('INFO', message, meta),
  warn: (message, meta) => log('WARN', message, meta),
  error: (message, meta) => log('ERROR', message, meta),
  debug: (message, meta) => log('DEBUG', message, meta),
  getLogs: () => [...logBuffer]
};

module.exports = logger;