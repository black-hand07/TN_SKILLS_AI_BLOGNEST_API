const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware: Authenticate a request using a Bearer JWT token.
 * Attaches the authenticated user document to req.user.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please log in again.',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Authentication failed.',
      });
    }

    // Fetch user from database to ensure it still exists and get current role
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User associated with this token no longer exists.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware factory: Authorize a request based on allowed roles.
 * Must be used AFTER the authenticate middleware.
 *
 * @param {...string} roles - Allowed role names (e.g., 'admin', 'editor').
 * @returns {Function} Express middleware function.
 *
 * @example
 *   router.delete('/:id', authenticate, authorizeRoles('admin', 'editor'), handler);
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user?.role || 'none'}.`,
      });
    }
    next();
  };
};

module.exports = { authenticate, authorizeRoles };
