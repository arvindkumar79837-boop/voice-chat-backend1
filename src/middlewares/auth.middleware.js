const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Get the token from the header (Bearer <token>)
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Adds { userId, uid } to the request object
    next();
  } catch (ex) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};