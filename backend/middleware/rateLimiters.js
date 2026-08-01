const rateLimit = require('express-rate-limit');

// Applied to every public, credential-guessing-prone auth endpoint (login,
// forgot-password lookup/reset). 10 attempts per 15 minutes per IP is generous
// enough for someone genuinely mistyping a password a few times, but stops rapid
// brute-forcing — the login endpoint had no throttling at all before this.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts from this device. Please wait a few minutes and try again.',
  },
});

// Baseline limit for the whole API, to blunt scraping and accidental request
// storms. Deliberately loose: a teacher working through a class register fires a
// lot of legitimate calls in a short burst, so this is set well above normal use
// and is only meant to stop abuse, not to shape traffic.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down and try again shortly.',
  },
});

// Tighter limit for admin write operations (creating/deleting students, batches,
// tests, recording payments). These are low-frequency by nature, so a low ceiling
// costs nothing in normal use while capping the damage a stolen admin token can do.
const adminWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many changes in a short time. Please wait a few minutes and try again.',
  },
});

module.exports = { authLimiter, globalLimiter, adminWriteLimiter };
