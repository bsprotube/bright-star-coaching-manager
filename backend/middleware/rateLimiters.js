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

module.exports = { authLimiter };
