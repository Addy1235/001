const { verifyAccessToken } = require('../utils/jwt');
const { unauthorized } = require('../utils/response');
const User = require('../models/User');

// Verify JWT and attach user to request
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, 'No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return unauthorized(res, 'Invalid or expired token');
    }

    // Attach user ID to request
    req.userId = decoded.sub;
    req.userEmail = decoded.email;

    next();
  } catch (error) {
    return unauthorized(res, 'Authentication failed');
  }
};

// Optional auth - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyAccessToken(token);

      if (decoded) {
        req.userId = decoded.sub;
        req.userEmail = decoded.email;
      }
    }

    next();
  } catch {
    next();
  }
};

module.exports = { authenticate, optionalAuth };
