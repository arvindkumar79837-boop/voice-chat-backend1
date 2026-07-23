// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/config/cors.js
// ARVIND PARTY - CORS CONFIGURATION
// Restrict origins in production for security
// ═══════════════════════════════════════════════════════════════════════════

const cors = require('cors');

// Allowed origins based on environment
const allowedOrigins = (() => {
  // Read from environment variable first
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  }

  if (process.env.NODE_ENV === 'production') {
    return [
      'https://api.arvindparty.com',
      'https://admin.arvindparty.com',
      'https://www.arvindparty.com',
      'https://arvindparty.com',
    ];
  }

  // Development: allow all common origins for testing
  return [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:8080',
    'http://localhost:52779',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    'http://192.168.1.100:5000',
    'http://192.168.1.100:3000',
    'http://192.168.1.100:52779',
  ];
})();

const corsConfig = cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, server-to-server).
    // Mobile native HTTP clients (Dio, http package) do NOT send Origin headers,
    // so rejecting them blocks the entire mobile app in production.
    // For browsers: always send Origin — if missing in production, treat as suspicious.
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        // In production, allow no-origin only from known mobile User-Agent patterns.
        // This is checked via the req reference if available, but cors middleware
        // doesn't pass req to origin callback. Instead, we allow no-origin and
        // rely on JWT authentication for API protection (CORS only protects browsers).
        // Mobile apps authenticate via JWT tokens, not cookies, so CORS bypass
        // doesn't create a CSRF vulnerability.
        return callback(null, true);
      }
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS rejected origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Request-ID'],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'X-Total-Count'],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200
});

module.exports = corsConfig;