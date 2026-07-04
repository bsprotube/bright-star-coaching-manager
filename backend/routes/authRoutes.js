const express = require('express');
const router = express.Router();
const { login, registerAdmin } = require('../controllers/authController');

router.post('/login', login);
router.post('/register-admin', registerAdmin);

module.exports = router;
