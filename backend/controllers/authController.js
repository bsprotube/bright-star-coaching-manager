const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET, JWT_EXPIRE } = require('../config/jwt');

// Helper: Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
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

// @desc    Get the logged-in user's own profile (used by Account Settings to
//          show whether a security question is already set, without ever
//          exposing the hashed answer)
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        securityQuestion: user.securityQuestion,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Self-service update of the logged-in user's own phone/email/password
//          and security question. Requires the current password, so anyone who
//          gets hold of a logged-in session still can't silently take over the
//          account's credentials.
// @route   PUT /api/auth/update-credentials
// @access  Private
const updateCredentials = async (req, res, next) => {
  try {
    const {
      currentPassword,
      newPhone,
      newEmail,
      newPassword,
      securityQuestion,
      securityAnswer,
    } = req.body;

    if (!currentPassword) {
      res.statusCode = 400;
      throw new Error('Please enter your current password to confirm changes');
    }

    const user = await User.findById(req.user._id);
    if (!user || !(await user.matchPassword(currentPassword))) {
      res.statusCode = 401;
      throw new Error('Current password is incorrect');
    }

    if (newPhone && newPhone.trim() !== user.phone) {
      const phoneExists = await User.findOne({ phone: newPhone.trim() });
      if (phoneExists) {
        res.statusCode = 400;
        throw new Error('Phone number is already in use by another user');
      }
      user.phone = newPhone.trim();
    }

    if (newEmail !== undefined) {
      const cleanEmail = newEmail && newEmail.trim() ? newEmail.trim().toLowerCase() : undefined;
      if (cleanEmail && cleanEmail !== user.email) {
        const emailExists = await User.findOne({ email: cleanEmail });
        if (emailExists) {
          res.statusCode = 400;
          throw new Error('Email is already in use by another user');
        }
      }
      user.email = cleanEmail;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        res.statusCode = 400;
        throw new Error('New password must be at least 6 characters');
      }
      user.password = newPassword;
    }

    // Security question and answer must be set together — a question with no
    // answer (or vice versa) would leave "Forgot Password" unusable.
    if (securityQuestion || securityAnswer) {
      if (!securityQuestion || !securityAnswer) {
        res.statusCode = 400;
        throw new Error('Please provide both a security question and its answer');
      }
      user.securityQuestion = securityQuestion.trim();
      user.securityAnswerHash = securityAnswer; // pre('save') hook hashes this
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Credentials updated successfully',
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        securityQuestion: user.securityQuestion,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Look up the security question for a phone number, as step 1 of the
//          forgot-password flow
// @route   POST /api/auth/forgot-password/question
// @access  Public
const getSecurityQuestion = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      res.statusCode = 400;
      throw new Error('Please provide a phone number');
    }

    const user = await User.findOne({ phone: phone.trim() });

    // Same error for "no such user" and "no question set" so this endpoint can't
    // be used to enumerate which phone numbers have accounts.
    if (!user || !user.securityQuestion) {
      res.statusCode = 404;
      throw new Error('No recovery question set up for this phone number. Please contact your administrator.');
    }

    res.status(200).json({
      success: true,
      question: user.securityQuestion,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify the security answer and set a new password in one step
// @route   POST /api/auth/forgot-password/reset
// @access  Public
const resetPasswordWithSecurityAnswer = async (req, res, next) => {
  try {
    const { phone, securityAnswer, newPassword } = req.body;

    if (!phone || !securityAnswer || !newPassword) {
      res.statusCode = 400;
      throw new Error('Please provide your phone number, the answer, and a new password');
    }

    if (newPassword.length < 6) {
      res.statusCode = 400;
      throw new Error('New password must be at least 6 characters');
    }

    const user = await User.findOne({ phone: phone.trim() }).select('+securityAnswerHash');
    if (!user || !(await user.matchSecurityAnswer(securityAnswer))) {
      res.statusCode = 401;
      throw new Error('Phone number or answer is incorrect');
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  registerAdmin,
  getMe,
  updateCredentials,
  getSecurityQuestion,
  resetPasswordWithSecurityAnswer,
};
