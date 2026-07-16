// src/middlewares/adminMiddleware.js
// Web Panel se aane wale admin requests verify karta hai
// Admin token alag se generate hota hai ya special role hota hai

const { verifyAccessToken, isTokenBlacklisted } = require('../utils/jwt');

// General Admin/Staff verification
const verifyStaff = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Staff authentication token required.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      return res.status(401).json({ success: false, message: 'Staff token has been revoked.' });
    }

    const decoded = verifyAccessToken(token);
    req.user = decoded;
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired staff token.' });
  }

  if (req.user && req.user.isStaff) {
    req.isAdmin = true;
    req.userRole = req.user.role;
    req.permissions = req.user.permissions || [];
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Staff access required. Unauthorized.'
  });
};

// STRICT OWNER ONLY MIDDLEWARE (For Coin Generation & Full App Control)
const verifyOwner = (req, res, next) => {
  verifyStaff(req, res, () => {
    if (req.userRole === 'OWNER.WEB') {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'CRITICAL: Permission Denied. Only OWNER can perform this action.'
    });
  });
};

// Dynamic Permission Checker (e.g., requirePermission('EDIT_ROOM'))
const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    verifyStaff(req, res, () => {
      if (req.userRole === 'OWNER.WEB' || req.permissions.includes(requiredPermission)) {
        return next();
      }
      return res.status(403).json({
        success: false,
        message: `Permission Denied. Missing required permission: ${requiredPermission}`
      });
    });
  };
};

module.exports = {
  verifyStaff,
  verifyOwner,
  requirePermission
};
