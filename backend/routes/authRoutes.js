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
const { authLimiter } = require('../middleware/rateLimiters');
const { validate } = require('../middleware/validate');
const { authSchemas } = require('../middleware/schemas');

router.post('/login', authLimiter, validate(authSchemas.login), login);
router.post('/register-admin', authLimiter, validate(authSchemas.registerAdmin), registerAdmin);

router.post('/forgot-password/options', authLimiter, validate(authSchemas.phoneOnly), getRecoveryOptions);
router.post('/forgot-password/question', authLimiter, validate(authSchemas.phoneOnly), getSecurityQuestion);
router.post('/forgot-password/send-otp', authLimiter, validate(authSchemas.phoneOnly), sendForgotPasswordOtp);
router.post(
  '/forgot-password/reset',
  authLimiter,
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
