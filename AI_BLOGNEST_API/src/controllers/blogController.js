const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Blog = require('../models/Blog');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      field: e.path || e.param,
      message: e.msg,
    }));
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formatted,
    });
    return true;
  }
  return false;
};

/**
 * Determine which statuses a user is allowed to view based on their role.
 * Public/readers see only published. Privileged roles see more.
 */
const getAllowedStatuses = (role) => {
  if (!role) return ['published'];
  if (role === 'admin' || role === 'editor') {
    return ['draft', 'pending', 'scheduled', 'published'];
  }
  if (role === 'author') {
    return ['draft', 'pending', 'scheduled', 'published'];
  }
  return ['published']; // reader
};

// ─── CREATE BLOG ──────────────────────────────────────────────────────────────

/**
 * POST /api/blogs
 * Create a new blog post.
 * Roles: admin, editor, author
 */
const createBlog = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const { title, content, summary, category, tags, status } = req.body;
    const authorId = req.user._id;
    const userRole = req.user.role;

    // Only editors/admins can directly publish; authors/readers cannot
    let finalStatus = status || 'draft';
    if (finalStatus === 'published' && userRole === 'author') {
      finalStatus = 'pending'; // Authors submit for review
    }

    const blog = await Blog.create({
      title,
      content,
      summary: summary || '',
      author: authorId,
      category,
      tags: tags || [],
      status: finalStatus,
    });

    await blog.populate('author', 'name email role');

    return res.status(201).json({
      success: true,
      message: 'Blog created successfully.',
      data: { blog },
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET ALL BLOGS ────────────────────────────────────────────────────────────

/**
 * GET /api/blogs
 * List blogs with optional filtering and search.
 * Public: only published blogs.
 * Authenticated admins/editors: all statuses.
 * Authenticated authors: their own blogs + published.
 *
 * Query params:
 *   search, category, tag, status, page, limit, author
 */
const getAllBlogs = async (req, res, next) => {
  try {
    const {
      search,
      category,
      tag,
      status,
      page = 1,
      limit = 10,
      author,
    } = req.query;

    const userRole = req.user?.role;
    const userId = req.user?._id;
    const allowedStatuses = getAllowedStatuses(userRole);

    // Build filter
    const filter = {};

    // Status filtering
    if (status) {
      if (!allowedStatuses.includes(status)) {
        return res.status(403).json({
          success: false,
          message: `You are not permitted to view blogs with status '${status}'.`,
        });
      }
      filter.status = status;
    } else {
      // Authors can see their own drafts/pending + all published
      if (userRole === 'author') {
        filter.$or = [
          { status: 'published' },
          { author: userId, status: { $in: ['draft', 'pending', 'scheduled'] } },
        ];
      } else {
        filter.status = { $in: allowedStatuses };
      }
    }

    // Category filter (case-insensitive)
    if (category) {
      filter.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    // Tag filter
    if (tag) {
      filter.tags = { $regex: new RegExp(tag, 'i') };
    }

    // Author filter
    if (author) {
      if (!mongoose.Types.ObjectId.isValid(author)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid author ID format.',
        });
      }
      filter.author = author;
    }

    // Full-text search
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const searchFilter = {
        $or: [
          { title: searchRegex },
          { content: searchRegex },
          { category: searchRegex },
          { tags: searchRegex },
          { summary: searchRegex },
        ],
      };
      // Merge search with existing filter
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, searchFilter];
        delete filter.$or;
      } else {
        Object.assign(filter, searchFilter);
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [blogs, total] = await Promise.all([
      Blog.find(filter)
        .populate('author', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-comments -likedBy'), // Omit heavy embedded docs for list view
      Blog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Blogs retrieved successfully.',
      data: {
        blogs,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET SINGLE BLOG ──────────────────────────────────────────────────────────

/**
 * GET /api/blogs/:id
 * Retrieve a single blog by ID.
 * Public: only if published.
 * Privileged: any status.
 */
const getBlogById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?._id?.toString();

    const blog = await Blog.findById(id)
      .populate('author', 'name email role')
      .populate('comments.user', 'name email');

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found.',
      });
    }

    // Access control
    const isAdminOrEditor = userRole === 'admin' || userRole === 'editor';
    const isOwner = blog.author?._id?.toString() === userId;

    if (blog.status !== 'published' && !isAdminOrEditor && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this blog.',
      });
    }

    // For non-privileged users, only show approved comments
    let responseBlog = blog.toObject();
    if (!isAdminOrEditor) {
      responseBlog.comments = responseBlog.comments.filter(
        (c) => c.status === 'approved'
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Blog retrieved successfully.',
      data: { blog: responseBlog },
    });
  } catch (error) {
    next(error);
  }
};

// ─── UPDATE BLOG ──────────────────────────────────────────────────────────────

/**
 * PUT /api/blogs/:id
 * Update an existing blog.
 * Authors can update their own blogs.
 * Editors/Admins can update any blog.
 */
const updateBlog = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const { id } = req.params;
    const userRole = req.user.role;
    const userId = req.user._id.toString();

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found.' });
    }

    const isAdminOrEditor = userRole === 'admin' || userRole === 'editor';
    const isOwner = blog.author.toString() === userId;

    if (!isAdminOrEditor && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this blog.',
      });
    }

    const { title, content, summary, category, tags, status } = req.body;

    // Authors cannot self-publish
    let finalStatus = status;
    if (finalStatus === 'published' && userRole === 'author') {
      finalStatus = 'pending';
    }

    // Apply updates
    if (title !== undefined) blog.title = title;
    if (content !== undefined) blog.content = content;
    if (summary !== undefined) blog.summary = summary;
    if (category !== undefined) blog.category = category;
    if (tags !== undefined) blog.tags = tags;
    if (finalStatus !== undefined) blog.status = finalStatus;

    await blog.save();
    await blog.populate('author', 'name email role');

    return res.status(200).json({
      success: true,
      message: 'Blog updated successfully.',
      data: { blog },
    });
  } catch (error) {
    next(error);
  }
};

// ─── DELETE BLOG ──────────────────────────────────────────────────────────────

/**
 * DELETE /api/blogs/:id
 * Delete a blog.
 * Authors can delete their own blogs.
 * Admins can delete any blog.
 */
const deleteBlog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;
    const userId = req.user._id.toString();

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found.' });
    }

    const isAdmin = userRole === 'admin';
    const isOwner = blog.author.toString() === userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this blog.',
      });
    }

    await Blog.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Blog deleted successfully.',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// ─── ADD COMMENT ──────────────────────────────────────────────────────────────

/**
 * POST /api/blogs/:id/comments
 * Add a comment to a blog.
 * Any authenticated user can comment on published blogs.
 */
const addComment = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const { id } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found.' });
    }

    if (blog.status !== 'published') {
      return res.status(403).json({
        success: false,
        message: 'Comments can only be added to published blogs.',
      });
    }

    const comment = {
      user: userId,
      text: text.trim(),
      status: 'pending',
    };

    blog.comments.push(comment);
    await blog.save();

    // Return the newly added comment
    const addedComment = blog.comments[blog.comments.length - 1];

    return res.status(201).json({
      success: true,
      message: 'Comment submitted successfully. It is pending moderation.',
      data: { comment: addedComment },
    });
  } catch (error) {
    next(error);
  }
};

// ─── MODERATE COMMENT ─────────────────────────────────────────────────────────

/**
 * PATCH /api/blogs/:id/comments/:commentId/moderate
 * Approve or mark a comment as spam.
 * Roles: admin, editor
 */
const moderateComment = async (req, res, next) => {
  try {
    const { id, commentId } = req.params;
    const { status } = req.body;

    if (!['approved', 'spam', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Comment status must be 'approved', 'pending', or 'spam'.",
      });
    }

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found.' });
    }

    const comment = blog.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found.' });
    }

    comment.status = status;
    await blog.save();

    return res.status(200).json({
      success: true,
      message: `Comment ${status} successfully.`,
      data: { comment },
    });
  } catch (error) {
    next(error);
  }
};

// ─── LIKE BLOG ────────────────────────────────────────────────────────────────

/**
 * POST /api/blogs/:id/like
 * Like or unlike a published blog.
 * Any authenticated user can like. Tracks per-user to prevent duplicates.
 */
const likeBlog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();

    const blog = await Blog.findById(id).select('+likedBy');
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found.' });
    }

    if (blog.status !== 'published') {
      return res.status(403).json({
        success: false,
        message: 'You can only like published blogs.',
      });
    }

    const alreadyLiked = blog.likedBy.some((uid) => uid.toString() === userId);

    if (alreadyLiked) {
      // Toggle: unlike
      blog.likedBy = blog.likedBy.filter((uid) => uid.toString() !== userId);
      blog.likes = Math.max(0, blog.likes - 1);
      await blog.save();
      return res.status(200).json({
        success: true,
        message: 'Blog unliked.',
        data: { likes: blog.likes },
      });
    } else {
      blog.likedBy.push(req.user._id);
      blog.likes += 1;
      await blog.save();
      return res.status(200).json({
        success: true,
        message: 'Blog liked.',
        data: { likes: blog.likes },
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  addComment,
  moderateComment,
  likeBlog,
};
