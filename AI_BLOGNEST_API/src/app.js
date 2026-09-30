const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const blogRoutes = require('./routes/blogRoutes');
const aiRoutes = require('./routes/aiRoutes');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

// ─── Create Express Application ───────────────────────────────────────────────

const app = express();

// ─── Security Middleware ──────────────────────────────────────────────────────

// Set security-related HTTP headers
app.use(helmet());

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Global Rate Limiting ─────────────────────────────────────────────────────

const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // 200 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
  },
});

app.use(globalRateLimit);

// ─── Body Parsing ─────────────────────────────────────────────────────────────

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── Request Logging ──────────────────────────────────────────────────────────

app.use(
  morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev')
);

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AI BlogNest API is running.',
    version: '1.0.0',
    docs: 'See README.md for API documentation.',
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Service is healthy.',
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/ai', aiRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use(notFound);

// ─── Centralized Error Handler ────────────────────────────────────────────────

// Must be LAST — after all routes and middleware
app.use(errorHandler);

module.exports = app;
