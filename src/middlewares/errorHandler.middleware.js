// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/middlewares/errorHandler.middleware.js
// ARVIND PARTY - GLOBAL ERROR HANDLER MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

const Logger = require('../utils/logger');

// Global Error Handler Middleware
module.exports = (err, req, res, next) => {
  // Default error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errorCode = 'INTERNAL_SERVER_ERROR';

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = Object.values(err.errors)
      .map(e => e.message)
      .join(', ');
  }

  // Mongoose Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 400;
    errorCode = 'DUPLICATE_ERROR';
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid or malformed token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Token has expired. Please login again.';
  }

  // Cast Error (invalid MongoDB ID)
  if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID';
    message = 'Invalid resource ID format';
  }

  // Log the error
  Logger.error(`${req.method} ${req.path}`, {
    statusCode,
    errorCode,
    message,
    userId: req.user?.userId,
    ip: req.ip
  });

  // Send error response (NO STACK TRACE IN PRODUCTION)
  res.status(statusCode).json({
    success: false,
    statusCode,
    errorCode,
    message,
    timestamp: new Date().toISOString(),
    path: req.path,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack, details: err })
  });
};
