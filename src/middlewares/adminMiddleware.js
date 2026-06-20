// src/middlewares/adminMiddleware.js
// Web Panel se aane wale admin requests verify karta hai
// Admin token alag se generate hota hai ya special role hota hai

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'arvind_admin_2024';
const jwt = require('jsonwebtoken');

// General Admin/Staff verification
const verifyStaff = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  
  // Fallback for super admin testing using secret key
  if (adminKey && adminKey === ADMIN_SECRET) {
    req.isAdmin = true;
    req.userRole = 'OWNER.WEB'; 
    return next();
  }
  
  // Parse JWT token from Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'arvind_party_super_secret_key');
      req.user = decoded;
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
  }

  // Real JWT Based Staff Verification
  if (req.user && req.user.isStaff) {
    req.isAdmin = true;
    req.userRole = req.user.role; // e.g., 'APP.ADMIN.WEB', 'BD.UID'
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
