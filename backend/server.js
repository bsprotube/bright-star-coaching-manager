const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const fs = require('fs');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');
const { globalLimiter } = require('./middleware/rateLimiters');
const { UPLOADS_DIR } = require('./config/uploads');
const { finalizeAllExpiredCodes } = require('./controllers/attendanceController');
const { generateDuesForAllActiveStudents } = require('./services/billingService');

// Load environment variables
dotenv.config();

// Connect to MongoDB database
connectDB();

const app = express();

// Render sits behind a reverse proxy, so req.ip is the proxy's address unless we
// trust its X-Forwarded-For header — needed for rate limiting (and any future
// IP-based logic) to see each client's real IP instead of treating every request
// as coming from the same address.
app.set('trust proxy', 1);

// Secure HTTP headers (HSTS, nosniff, frameguard, referrer policy, and friends).
// crossOriginResourcePolicy is relaxed to cross-origin because student photos are
// served from /uploads and loaded by the frontend on a different origin; helmet's
// same-origin default would block those images.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Baseline rate limit for the whole API. Auth endpoints get a much tighter limit
// of their own on top of this (see routes/authRoutes).
app.use('/api', globalLimiter);

// CORS allowlist. Browser clients (web frontend) send an Origin header that must
// match this list — native mobile requests and server-to-server calls (curl,
// health checks) don't send one at all and are always let through, since CORS is
// a browser-enforced protection, not a server-side auth mechanism.
//
// Production frontend URLs come from the FRONTEND_URLS env var (comma-separated).
// Local Expo dev servers are allowed too, but only outside production — in a
// deployed environment there is no reason to trust a localhost origin, and leaving
// it allowed would let a page running on a visitor's own machine call this API.
const DEV_ORIGINS = ['http://localhost:8081', 'http://localhost:19006', 'http://127.0.0.1:8081'];
const isProduction = process.env.NODE_ENV === 'production';
const configuredOrigins = (process.env.FRONTEND_URLS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = isProduction ? configuredOrigins : [...DEV_ORIGINS, ...configuredOrigins];

if (isProduction && allowedOrigins.length === 0) {
  console.warn(
    'WARNING: NODE_ENV=production but FRONTEND_URLS is not set — every browser origin will be rejected by CORS.'
  );
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} is not allowed`));
    },
  })
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Strip any request key starting with "$" or containing "." from body/query/params
// (e.g. {"phone": {"$gt": ""}}) before it can reach a Mongoose query as an operator.
// Verified during the security audit that such payloads were reaching the DB layer
// unfiltered on the login endpoint.
app.use(mongoSanitize());

// Create the uploads folder on start if it doesn't exist. Its location is
// configurable (see config/uploads) so a hosted deployment can point it at a
// persistent disk instead of the container's ephemeral filesystem.
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log(`Created uploads directory: ${UPLOADS_DIR}`);
}

// Serve static files (student photos). These aren't behind login — profile photos
// are shown across many list screens for multiple students at once, and properly
// gating that would mean threading an auth token through every <Image> on both web
// and native. Given the low sensitivity of a profile photo, the mitigation here is
// proportionate instead: uploaded filenames are unguessable (timestamp + random
// suffix, set in studentRoutes' multer config) rather than sequential, only image
// extensions can ever be served even if a stray non-image file ended up in the
// folder, and X-Content-Type-Options blocks the browser from executing a file as
// something other than what its extension says.
app.use(
  '/uploads',
  (req, res, next) => {
    if (!/\.(jpe?g|png)$/i.test(req.path)) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  },
  express.static(UPLOADS_DIR)
);

// Mount Route Routers
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/batches', require('./routes/batchRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/fees', require('./routes/feeRoutes'));
app.use('/api/tests', require('./routes/testRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/study-materials', require('./routes/studyMaterialRoutes'));

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