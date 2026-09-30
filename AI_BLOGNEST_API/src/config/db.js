const mongoose = require('mongoose');

/**
 * Connect to MongoDB using Mongoose.
 * The application will exit if the connection cannot be established.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Handle graceful shutdown on SIGINT (Ctrl+C).
 * Closes the Mongoose connection before exiting.
 */
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed due to app termination.');
    process.exit(0);
  } catch (err) {
    console.error('Error during MongoDB disconnect:', err.message);
    process.exit(1);
  }
});

module.exports = connectDB;
