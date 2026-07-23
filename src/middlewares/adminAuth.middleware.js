// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/middlewares/adminAuth.middleware.js
// ARVIND PARTY — Role-Based Admin Access Control
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Requires the authenticated user to have admin or staff role.
 * Use after authMiddleware.
 */
const requireAdmin = (req, res, next) => {
  const role = req.user?.role;
  if (!role || !['admin', 'owner'].includes(role)) {
    return res.status(403).json({
      success: false,
      code: 'ADMIN_REQUIRED',
      message: 'Admin access required.',
    });
  }
  next();
};

/**
 * Requires the authenticated user to be the owner.
 * Used for treasury, coin-mint, staff-ban routes.
 */
const requireOwner = (req, res, next) => {
  if (req.user?.role !== 'owner') {
    return res.status(403).json({
      success: false,
      code: 'OWNER_REQUIRED',
      message: 'Owner access required.',
    });
  }
  next();
};

/**
 * Requires the user to be admin, owner, or staff.
 * Flexible check for broader admin panel access.
 */
const requireStaffOrAdmin = (req, res, next) => {
  const role = req.user?.role;
  const allowedRoles = ['admin', 'owner', 'host'];
  if (!role || !allowedRoles.includes(role)) {
    // Also allow isAdmin/isStaff flags on user object
    if (!req.user?.isAdmin && !req.user?.isStaff) {
      return res.status(403).json({
        success: false,
        code: 'STAFF_REQUIRED',
        message: 'Staff or admin access required.',
      });
    }
  }
  next();
};

module.exports = { requireAdmin, requireOwner, requireStaffOrAdmin };
