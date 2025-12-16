const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { jwt: config } = require('../config/auth');

// Generate access token (short-lived)
const generateAccessToken = (userId, email) => {
  return jwt.sign(
    { sub: userId, email },
    config.secret,
    { expiresIn: config.accessExpires }
  );
};

// Generate refresh token (opaque random string)
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('base64url');
};

// Verify access token
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.secret);
  } catch (error) {
    return null;
  }
};

// Hash refresh token for storage
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  hashToken
};
