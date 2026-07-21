const express = require('express');
const router = express.Router();
const {
  login,
  registerAdmin,
  getMe,
  updateCredentials,
  getSecurityQuestion,
  resetPasswordWithSecurityAnswer,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiters');

router.post('/login', authLimiter, login);
router.post('/register-admin', authLimiter, registerAdmin);

router.post('/forgot-password/question', authLimiter, getSecurityQuestion);
router.post('/forgot-password/reset', authLimiter, resetPasswordWithSecurityAnswer);

router.get('/me', protect, getMe);
router.put('/update-credentials', protect, updateCredentials);

module.exports = router;
