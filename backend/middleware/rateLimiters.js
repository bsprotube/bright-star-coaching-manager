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

// Companion to authLimiter, keyed on the phone number being targeted rather than
// on the caller's address. authLimiter alone caps how fast one machine can guess,
// but the thing actually worth protecting is a single account: a six-digit OTP or
// a security answer is guessable in far fewer than a million tries, and an
// attacker spreading requests across many IPs would never trip a per-IP limit
// while hammering one victim's number. Requests without a phone in the body are
// skipped entirely, so this never falls back to keying on an IP address.
const phoneAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => typeof req.body?.phone !== 'string' || !req.body.phone.trim(),
  keyGenerator: (req) => `phone:${req.body.phone.trim()}`,
  message: {
    success: false,
    message: 'Too many attempts for this account. Please wait a few minutes and try again.',
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

module.exports = { authLimiter, phoneAuthLimiter, globalLimiter, adminWriteLimiter };
