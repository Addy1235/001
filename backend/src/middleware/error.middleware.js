const { serverError, error } = require('../utils/response');

// Global error handler
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return error(res, 'Validation failed', 400, messages);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return error(res, `${field} already exists`, 409);
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return error(res, 'Invalid ID format', 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return error(res, 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return error(res, 'Token expired', 401);
  }

  // Zod validation error
  if (err.name === 'ZodError') {
    const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    return error(res, 'Validation failed', 400, messages);
  }

  // Default to 500
  return serverError(res, process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message
  );
};

// 404 handler
const notFoundHandler = (req, res) => {
  return error(res, `Route ${req.method} ${req.url} not found`, 404);
};

module.exports = { errorHandler, notFoundHandler };
