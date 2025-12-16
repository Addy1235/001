module.exports = {
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-change-me',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d'
  }
};
