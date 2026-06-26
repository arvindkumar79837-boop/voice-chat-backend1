// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/middlewares/auth.middleware.js
// ARVIND PARTY — Identity & Authentication Guard
// • Verifies 15-min Access Token
// • Returns 401 + refresh hint when expired (client can then call /refresh)
// • Checks user is not banned in-memory using token payload
// ═══════════════════════════════════════════════════════════════════════════

const { verifyAccessToken, isTokenBlacklisted } = require('../utils/jwt');

/**
 * Primary auth middleware used on all protected routes.
 * Decodes the JWT Access Token from Authorization header.
 * On expiry (TokenExpiredError) it returns a machine-readable code
 * so the Flutter app's Dio interceptor knows to call /auth/refresh.
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      code: 'NO_TOKEN',
      message: 'Authentication token is required.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Check if token is blacklisted (logout / forced revocation)
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_REVOKED',
        message: 'This token has been revoked. Please log in again.',
      });
    }
    const decoded = verifyAccessToken(token);
    req.user = decoded; // { id, role, uid, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Access token has expired. Please refresh.',
      });
    }
    return res.status(401).json({
      success: false,
      code: 'INVALID_TOKEN',
      message: 'Invalid or malformed token.',
    });
  }
};

/**
 * Role-based access guard factory.
 * Usage: router.get('/route', authMiddleware, requireRole('admin', 'owner'), handler)
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      message: `Access denied. Required role(s): ${roles.join(', ')}.`,
    });
  }
  next();
};

/**
 * 2FA enforcement middleware for ultra-sensitive admin routes.
 * Checks that the request carries the X-2FA-Verified header set by
 * the admin panel after successful OTP / Google Authenticator verification.
 * This is an honour-based server check — the actual TOTP/OTP validation
 * happens in the /auth/verify-2fa endpoint.
 */
const require2FA = (req, res, next) => {
  const verified = req.headers['x-2fa-verified'];
  if (verified !== 'true') {
    return res.status(403).json({
      success: false,
      code: '2FA_REQUIRED',
      message: 'Two-Factor Authentication is required to access this resource.',
    });
  }
  next();
};

module.exports = { authMiddleware, requireRole, require2FA };
