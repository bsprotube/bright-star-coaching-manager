const express = require('express');
const router = express.Router();
const {
  login,
  registerAdmin,
  getMe,
  requestOtp,
  updateCredentials,
  getRecoveryOptions,
  getSecurityQuestion,
  sendForgotPasswordOtp,
  resetPasswordWithSecurityAnswer,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter, phoneAuthLimiter } = require('../middleware/rateLimiters');
const { validate } = require('../middleware/validate');
const { authSchemas } = require('../middleware/schemas');

// The one-time bootstrap endpoint stays sealed unless it's deliberately switched
// on. Sitting ahead of validate(), it answers a plain 404 rather than a schema
// error, so a probe can't tell the route exists at all while it's off.
const adminRegistrationEnabled = (req, res, next) => {
  if (process.env.ALLOW_ADMIN_REGISTRATION !== 'true') {
    res.statusCode = 404;
    return next(new Error('Not Found'));
  }
  next();
};

// Every public endpoint that takes a phone number gets both limiters: authLimiter
// caps one caller's overall rate, phoneAuthLimiter caps how many attempts a single
// account can absorb no matter how many addresses they come from.
router.post('/login', authLimiter, phoneAuthLimiter, validate(authSchemas.login), login);
router.post(
  '/register-admin',
  adminRegistrationEnabled,
  authLimiter,
  validate(authSchemas.registerAdmin),
  registerAdmin
);

router.post('/forgot-password/options', authLimiter, phoneAuthLimiter, validate(authSchemas.phoneOnly), getRecoveryOptions);
router.post('/forgot-password/question', authLimiter, phoneAuthLimiter, validate(authSchemas.phoneOnly), getSecurityQuestion);
router.post('/forgot-password/send-otp', authLimiter, phoneAuthLimiter, validate(authSchemas.phoneOnly), sendForgotPasswordOtp);
router.post(
  '/forgot-password/reset',
  authLimiter,
  phoneAuthLimiter,
  validate(authSchemas.forgotPasswordReset),
  resetPasswordWithSecurityAnswer
);

router.get('/me', protect, getMe);
router.post('/request-otp', protect, authLimiter, requestOtp);
router.put(
  '/update-credentials',
  protect,
  authLimiter,
  validate(authSchemas.updateCredentials),
  updateCredentials
);

module.exports = router;
