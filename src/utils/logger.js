// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/utils/logger.js
// ARVIND PARTY - STRUCTURED LOGGING UTILITY
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

class Logger {
  static _formatTimestamp() {
    return new Date().toISOString();
  }

  static _writeToFile(level, message, data) {
    if (process.env.NODE_ENV === 'production' && process.env.LOG_TO_FILE === 'true') {
      const logFile = path.join(logsDir, `${level.toLowerCase()}-${new Date().toISOString().split('T')[0]}.log`);
      const logEntry = `[${this._formatTimestamp()}] [${level}] ${message} ${data ? JSON.stringify(data) : ''}\n`;
      fs.appendFileSync(logFile, logEntry);
    }
  }

  static info(message, data = null) {
    const timestamp = this._formatTimestamp();
    const output = `[${timestamp}] ✅ [INFO] ${message}`;
    console.log(output, data || '');
    this._writeToFile('INFO', message, data);
  }

  static error(message, data = null) {
    const timestamp = this._formatTimestamp();
    const output = `[${timestamp}] ❌ [ERROR] ${message}`;
    console.error(output, data || '');
    this._writeToFile('ERROR', message, data);
  }

  static warn(message, data = null) {
    const timestamp = this._formatTimestamp();
    const output = `[${timestamp}] ⚠️ [WARN] ${message}`;
    console.warn(output, data || '');
    this._writeToFile('WARN', message, data);
  }

  static debug(message, data = null) {
    if (process.env.DEBUG_LOGS === 'true' || !process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
      const timestamp = this._formatTimestamp();
      const output = `[${timestamp}] 🔍 [DEBUG] ${message}`;
      console.log(output, data || '');
    }
  }

  static http(method, path, statusCode, duration, ip) {
    if (process.env.HTTP_LOGS === 'true' || process.env.DEBUG_LOGS === 'true') {
      const timestamp = this._formatTimestamp();
      const color = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : '✅';
      console.log(`[${timestamp}] 📡 [HTTP] ${color} ${method} ${path} - ${statusCode} (${duration}ms) from ${ip}`);
    }
  }

  static api(action, endpoint, userId = null, result = 'success') {
    if (process.env.API_LOGS === 'true' || process.env.DEBUG_LOGS === 'true') {
      const timestamp = this._formatTimestamp();
      const icon = result === 'success' ? '✅' : '❌';
      const userInfo = userId ? ` [User: ${userId}]` : '';
      console.log(`[${timestamp}] ${icon} [API] ${action} ${endpoint}${userInfo}`);
    }
  }

  static socket(event, action, userId = null) {
    const timestamp = this._formatTimestamp();
    console.log(`[${timestamp}] 🔌 [SOCKET] ${event} - ${action} ${userId ? `[User: ${userId}]` : ''}`);
  }

  static database(query, duration, success = true) {
    if (process.env.DB_LOGS === 'true' || process.env.DEBUG_LOGS === 'true') {
      const timestamp = this._formatTimestamp();
      const icon = success ? '✅' : '❌';
      console.log(`[${timestamp}] ${icon} [DB] ${query} (${duration}ms)`);
    }
  }
}

module.exports = Logger;
