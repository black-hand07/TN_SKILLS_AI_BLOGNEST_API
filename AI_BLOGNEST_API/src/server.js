'use strict';

// Load environment variables FIRST — before any other imports
require('dotenv').config();

const connectDB = require('./config/db');
const app = require('./app');

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ─── Validate Required Environment Variables ──────────────────────────────────

const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'GEMINI_API_KEY', 'GEMINI_MODEL'];
const missing = requiredEnvVars.filter((v) => !process.env[v]);

if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  console.error('Please configure your .env file and restart the server.');
  process.exit(1);
}

// ─── Start Server ─────────────────────────────────────────────────────────────

const startServer = async () => {
  try {
    // Connect to MongoDB before starting the HTTP server
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════╗');
      console.log('║          AI BlogNest API — Server Started        ║');
      console.log('╠══════════════════════════════════════════════════╣');
      console.log(`║  Environment : ${NODE_ENV.padEnd(32)}║`);
      console.log(`║  Port        : ${String(PORT).padEnd(32)}║`);
      console.log(`║  Base URL    : http://localhost:${String(PORT).padEnd(17)}║`);
      console.log(`║  Gemini Model: ${(process.env.GEMINI_MODEL || '').padEnd(32)}║`);
      console.log('╚══════════════════════════════════════════════════╝');
      console.log('');
    });

    // ── Graceful Shutdown ───────────────────────────────────────────────────────
    const shutdown = (signal) => {
      console.log(`\n⚠️  ${signal} received. Shutting down gracefully...`);
      server.close(() => {
        console.log('🛑 HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // ── Unhandled Rejections ────────────────────────────────────────────────────
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection:', reason);
      server.close(() => process.exit(1));
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
