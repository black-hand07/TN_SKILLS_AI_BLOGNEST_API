const express = require('express');
const { body } = require('express-validator');
const {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  addComment,
  moderateComment,
  likeBlog,
} = require('../controllers/blogController');
const { authenticate, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// ─── Validation Rules ─────────────────────────────────────────────────────────

const blogCreateValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required.')
    .isLength({ min: 5, max: 300 }).withMessage('Title must be 5-300 characters.'),

  body('content')
    .trim()
    .notEmpty().withMessage('Content is required.')
    .isLength({ min: 50 }).withMessage('Content must be at least 50 characters.'),

  body('category')
    .trim()
    .notEmpty().withMessage('Category is required.')
    .isLength({ max: 100 }).withMessage('Category cannot exceed 100 characters.'),

  body('tags')
    .optional()
    .isArray({ max: 20 }).withMessage('Tags must be an array with at most 20 items.'),

  body('tags.*')
    .optional()
    .isString().withMessage('Each tag must be a string.')
    .trim(),

  body('status')
    .optional()
    .isIn(['draft', 'pending', 'scheduled', 'published'])
    .withMessage('Status must be: draft, pending, scheduled, or published.'),

  body('summary')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Summary cannot exceed 1000 characters.'),
];

const blogUpdateValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 300 }).withMessage('Title must be 5-300 characters.'),

  body('content')
    .optional()
    .trim()
    .isLength({ min: 50 }).withMessage('Content must be at least 50 characters.'),

  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Category cannot exceed 100 characters.'),

  body('tags')
    .optional()
    .isArray({ max: 20 }).withMessage('Tags must be an array with at most 20 items.'),

  body('status')
    .optional()
    .isIn(['draft', 'pending', 'scheduled', 'published'])
    .withMessage('Status must be: draft, pending, scheduled, or published.'),

  body('summary')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Summary cannot exceed 1000 characters.'),
];

const commentValidation = [
  body('text')
    .trim()
    .notEmpty().withMessage('Comment text is required.')
    .isLength({ min: 1, max: 2000 }).withMessage('Comment must be 1-2000 characters.'),
];

// ─── Blog Routes ──────────────────────────────────────────────────────────────

/**
 * POST /api/blogs
 * Create a new blog.
 * Roles: admin, editor, author
 */
router.post(
  '/',
  authenticate,
  authorizeRoles('admin', 'editor', 'author'),
  blogCreateValidation,
  createBlog
);

/**
 * GET /api/blogs
 * List blogs (with optional search/filter/pagination).
 * Public access — unauthenticated users see only published blogs.
 * Authenticated users may see additional statuses based on role.
 *
 * Query params: search, category, tag, status, page, limit, author
 */
router.get('/', (req, res, next) => {
  // Optional authentication — don't fail if no token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticate(req, res, next);
  }
  next();
}, getAllBlogs);

/**
 * GET /api/blogs/:id
 * Get a single blog by ID.
 * Public access — unauthenticated users can only see published blogs.
 */
router.get('/:id', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticate(req, res, next);
  }
  next();
}, getBlogById);

/**
 * PUT /api/blogs/:id
 * Update a blog.
 * Authors: own blogs only. Editors/Admins: any blog.
 */
router.put(
  '/:id',
  authenticate,
  authorizeRoles('admin', 'editor', 'author'),
  blogUpdateValidation,
  updateBlog
);

/**
 * DELETE /api/blogs/:id
 * Delete a blog.
 * Authors: own blogs only. Admins: any blog.
 */
router.delete(
  '/:id',
  authenticate,
  authorizeRoles('admin', 'author'),
  deleteBlog
);

/**
 * POST /api/blogs/:id/comments
 * Add a comment to a blog.
 * Any authenticated user (all roles).
 */
router.post(
  '/:id/comments',
  authenticate,
  commentValidation,
  addComment
);

/**
 * PATCH /api/blogs/:id/comments/:commentId/moderate
 * Moderate a comment (approve / spam / pending).
 * Roles: admin, editor
 */
router.patch(
  '/:id/comments/:commentId/moderate',
  authenticate,
  authorizeRoles('admin', 'editor'),
  moderateComment
);

/**
 * POST /api/blogs/:id/like
 * Like or unlike a published blog.
 * Any authenticated user.
 */
router.post('/:id/like', authenticate, likeBlog);

module.exports = router;
