// Compatible with both:
//   - adminMiddleware.js (sets req.isAdmin, req.userRole = 'OWNER.WEB')
//   - Standalone JWT auth (sets req.user.role = 'admin')
module.exports = (req, res, next) => {
  if (req.isAdmin) {
    return next();
  }
  if (req.userRole && (req.userRole === 'OWNER.WEB' || req.userRole.includes('ADMIN'))) {
    return next();
  }
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  
  return res.status(403).json({ success: false, message: 'Forbidden. Admin privileges required.' });
};
