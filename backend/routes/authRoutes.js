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

router.post('/login', authLimiter, login);
router.post('/register-admin', authLimiter, registerAdmin);

router.post('/forgot-password/options', authLimiter, getRecoveryOptions);
router.post('/forgot-password/question', authLimiter, getSecurityQuestion);
router.post('/forgot-password/send-otp', authLimiter, sendForgotPasswordOtp);
router.post('/forgot-password/reset', authLimiter, resetPasswordWithSecurityAnswer);

router.get('/me', protect, getMe);
router.post('/request-otp', protect, authLimiter, requestOtp);
router.put('/update-credentials', protect, updateCredentials);

module.exports = router;
