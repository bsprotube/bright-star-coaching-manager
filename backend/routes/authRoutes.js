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

router.post('/login', login);
router.post('/register-admin', registerAdmin);

router.post('/forgot-password/question', getSecurityQuestion);
router.post('/forgot-password/reset', resetPasswordWithSecurityAnswer);

router.get('/me', protect, getMe);
router.put('/update-credentials', protect, updateCredentials);

module.exports = router;
