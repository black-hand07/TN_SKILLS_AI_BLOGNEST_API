const mongoose = require('mongoose');

// ─── Embedded Comment Schema ──────────────────────────────────────────────────

const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Comment must belong to a user'],
    },
    text: {
      type: String,
      required: [true, 'Comment text is required'],
      trim: true,
      minlength: [1, 'Comment cannot be empty'],
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'spam'],
        message: 'Comment status must be: pending, approved, or spam',
      },
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// ─── Blog Schema ──────────────────────────────────────────────────────────────

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Blog title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [300, 'Title cannot exceed 300 characters'],
    },
    content: {
      type: String,
      required: [true, 'Blog content is required'],
      minlength: [50, 'Content must be at least 50 characters'],
    },
    summary: {
      type: String,
      trim: true,
      maxlength: [1000, 'Summary cannot exceed 1000 characters'],
      default: '',
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Blog must have an author'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      maxlength: [100, 'Category cannot exceed 100 characters'],
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr) {
          return arr.length <= 20;
        },
        message: 'Cannot have more than 20 tags',
      },
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'pending', 'scheduled', 'published'],
        message: 'Status must be: draft, pending, scheduled, or published',
      },
      default: 'draft',
    },
    comments: {
      type: [commentSchema],
      default: [],
    },
    likes: {
      type: Number,
      default: 0,
      min: [0, 'Likes cannot be negative'],
    },
    // Track which users liked this blog to prevent duplicate likes
    likedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

blogSchema.index({ title: 'text', content: 'text' }); // Full-text search
blogSchema.index({ category: 1 });
blogSchema.index({ tags: 1 });
blogSchema.index({ status: 1 });
blogSchema.index({ author: 1 });
blogSchema.index({ createdAt: -1 });

// ─── Sanitize tags (trim + lowercase) before saving ──────────────────────────

blogSchema.pre('save', function (next) {
  if (this.isModified('tags')) {
    this.tags = this.tags
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }
  next();
});

const Blog = mongoose.model('Blog', blogSchema);

module.exports = Blog;
