const mongoose = require('mongoose');

/**
 * Centralized error handling middleware.
 * Must be registered LAST in Express app (after all routes).
 *
 * Handles:
 *  - express-validator validation errors (passed via next({ validationErrors }))
 *  - Mongoose validation errors
 *  - Mongoose duplicate key errors (E11000)
 *  - Mongoose invalid ObjectId (CastError)
 *  - JWT errors
 *  - Generic / unexpected errors
 */
const errorHandler = (err, req, res, next) => {
  // Default values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // ── express-validator errors (passed as { validationErrors: [...] }) ──────
  if (err.validationErrors) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.validationErrors,
    });
  }

  // ── Mongoose Validation Error ─────────────────────────────────────────────
  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(statusCode).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  // ── Mongoose Duplicate Key Error ──────────────────────────────────────────
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    message = `Duplicate value for '${field}': '${value}'. Please use a different value.`;
    return res.status(statusCode).json({ success: false, message });
  }

  // ── Mongoose CastError (invalid ObjectId) ─────────────────────────────────
  if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid value for '${err.path}': '${err.value}'.`;
    return res.status(statusCode).json({ success: false, message });
  }

  // ── JWT Errors ────────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res
      .status(401)
      .json({ success: false, message: 'Token has expired.' });
  }

  // ── Log unexpected errors (hide stack in production) ─────────────────────
  if (process.env.NODE_ENV !== 'production') {
    console.error('❌ Unhandled Error:', err);
  } else {
    console.error(`❌ Error [${statusCode}]: ${message}`);
  }

  // ── Generic fallback ──────────────────────────────────────────────────────
  res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Internal server error'
        : message,
  });
};

/**
 * 404 handler — called when no route matches.
 */
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

module.exports = { errorHandler, notFound };
