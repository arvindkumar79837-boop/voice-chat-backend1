// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/middlewares/request-logger.middleware.js
// ARVIND PARTY - REQUEST LOGGING MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

const Logger = require('../utils/logger');

const requestLoggerMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const ip = req.ip || req.connection.remoteAddress;

  // Capture the response end
  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    const duration = Date.now() - startTime;
    Logger.http(req.method, req.path, res.statusCode, duration, ip);
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

module.exports = requestLoggerMiddleware;
