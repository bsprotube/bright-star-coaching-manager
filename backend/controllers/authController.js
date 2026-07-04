const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper: Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretkeyforbrightstarcoachingmanager2026', {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    // Validate email & password
    if (!phone || !password) {
      res.statusCode = 400;
      throw new Error('Please provide a phone number and password');
    }

    // Check for user
    const user = await User.findOne({ phone });

    if (!user || !(await user.matchPassword(password))) {
      res.statusCode = 401;
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      res.statusCode = 401;
      throw new Error('User account is deactivated');
    }

    res.status(200).json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register initial admin
// @route   POST /api/auth/register-admin
// @access  Public (Should be blocked or secured in real prod after first run)
const registerAdmin = async (req, res, next) => {
  try {
    const { name, phone, email, password } = req.body;

    // Check if any admin exists
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      res.statusCode = 400;
      throw new Error('Admin already exists. Use regular login.');
    }

    const user = await User.create({
      name,
      phone,
      email,
      password,
      role: 'admin',
    });

    res.status(201).json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  registerAdmin,
};
