module.exports = (req, res, next) => {
  // The `auth` middleware should run before this and attach the decoded token to req.user.
  // We check if the user exists and if their role is strictly 'admin'.
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  
  return res.status(403).json({ success: false, message: 'Forbidden. Admin privileges required.' });
};