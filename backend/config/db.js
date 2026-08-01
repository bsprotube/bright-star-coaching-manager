const mongoose = require('mongoose');

// Fail loudly if MONGO_URI isn't configured, rather than silently falling back to
// a local database. A fallback here is genuinely dangerous: on a host that happens
// to have MongoDB running, a missing env var would quietly connect the app to an
// empty local database and it would start serving — and writing — as though
// everything were fine, while the real data sat untouched somewhere else.
const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI environment variable is not set. Refusing to start.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
