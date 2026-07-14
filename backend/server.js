const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');
const { finalizeAllExpiredCodes } = require('./controllers/attendanceController');
const { generateDuesForAllActiveStudents } = require('./services/billingService');

// Load environment variables
dotenv.config();

// Connect to MongoDB database
connectDB();

const app = express();

// Enable CORS
app.use(cors());

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create 'uploads' folder dynamically on start if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log('Created uploads directory');
}

// Serve static files (student photos)
app.use('/uploads', express.static(uploadsDir));

// Mount Route Routers
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/batches', require('./routes/batchRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/fees', require('./routes/feeRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

// Root Status Check Route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Bright Star Coaching Manager API is running...',
    version: '1.0.0',
    timestamp: new Date(),
  });
});

// Catch-all 404 Route
app.use((req, res, next) => {
  res.statusCode = 404;
  const error = new Error(`Not Found - ${req.originalUrl}`);
  next(error);
});

// Centralized Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Background scheduler: automatic absent-marking.
// Every 60 seconds, check every batch's attendance code — any that has
// expired gets finalized (unmarked students become "absent") without
// anyone needing to open the app. Runs once immediately on startup too,
// in case codes expired while the server was down.
const ABSENT_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

const runAbsentCheck = async () => {
  try {
    await finalizeAllExpiredCodes();
  } catch (err) {
    console.error(`Background absent-check failed: ${err.message}`);
  }
};

runAbsentCheck();
setInterval(runAbsentCheck, ABSENT_CHECK_INTERVAL_MS);

// Background scheduler: automatic monthly fee generation.
// Every 5 minutes, back-fill any missing billing cycles for every active
// student. This used to run on every single /fees/dues request, which
// became slow (and eventually timed out) as the number of students grew —
// moving it to a periodic background job keeps that endpoint fast while
// still keeping fee records automatically up to date.
const BILLING_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const runBillingCheck = async () => {
  try {
    await generateDuesForAllActiveStudents();
  } catch (err) {
    console.error(`Background billing-check failed: ${err.message}`);
  }
};

runBillingCheck();
setInterval(runBillingCheck, BILLING_CHECK_INTERVAL_MS);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`Unhandled Rejection Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});