const express = require('express');
const { body } = require('express-validator');
const { generateBlog, summarizeBlog } = require('../controllers/aiController');
const { authenticate, authorizeRoles } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// ─── Stricter Rate Limit for AI Endpoints ────────────────────────────────────

const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 AI requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many AI requests. Please wait before trying again.',
  },
  skipSuccessfulRequests: false,
});

// ─── Validation Rules ─────────────────────────────────────────────────────────

const generateBlogValidation = [
  body('topic')
    .trim()
    .notEmpty().withMessage('Topic is required.')
    .isLength({ min: 3, max: 300 }).withMessage('Topic must be 3-300 characters.'),

  body('category')
    .trim()
    .notEmpty().withMessage('Category is required.')
    .isLength({ min: 2, max: 100 }).withMessage('Category must be 2-100 characters.'),

  body('keywords')
    .notEmpty().withMessage('Keywords are required.')
    .isArray({ min: 1, max: 10 }).withMessage('Keywords must be an array of 1-10 items.'),

  body('keywords.*')
    .trim()
    .isString().withMessage('Each keyword must be a string.')
    .isLength({ min: 1, max: 50 }).withMessage('Each keyword must be 1-50 characters.'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters.'),

  body('audience')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Audience cannot exceed 200 characters.'),

  body('length')
    .optional()
    .isIn(['short', 'medium', 'long']).withMessage("Length must be 'short', 'medium', or 'long'."),
];

const summarizeValidation = [
  body('content')
    .trim()
    .notEmpty().withMessage('Content is required.')
    .isLength({ min: 50 }).withMessage('Content must be at least 50 characters to summarize.')
    .isLength({ max: 50000 }).withMessage('Content cannot exceed 50,000 characters.'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/generate-blog
 * Generate a complete blog article using Gemini AI.
 * Roles: admin, editor, author
 */
router.post(
  '/generate-blog',
  aiRateLimit,
  authenticate,
  authorizeRoles('admin', 'editor', 'author'),
  generateBlogValidation,
  generateBlog
);

/**
 * POST /api/ai/summarize
 * Summarize provided blog content using Gemini AI.
 * Any authenticated user.
 */
router.post(
  '/summarize',
  aiRateLimit,
  authenticate,
  summarizeValidation,
  summarizeBlog
);

module.exports = router;
