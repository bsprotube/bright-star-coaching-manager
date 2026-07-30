const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET, JWT_EXPIRE } = require('../config/jwt');
const { isEmailConfigured, sendOtpEmail } = require('../services/emailService');

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

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

// @desc    Email a one-time code to the logged-in user's CURRENT on-file email —
//          step 1 before changing phone or password in Account Settings. Sent to
//          the email already on the account (not any new one being typed in the
//          same form), so someone who's hijacked a session can't redirect the OTP
//          to an inbox they control.
// @route   POST /api/auth/request-otp
// @access  Private
const requestOtp = async (req, res, next) => {
  try {
    if (!isEmailConfigured()) {
      res.statusCode = 500;
      throw new Error('Email verification is not set up on the server yet. Contact your administrator.');
    }

    const user = await User.findById(req.user._id);
    if (!user.email) {
      res.statusCode = 400;
      throw new Error('Please set an email address in Account Settings first, then try again.');
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.otpHash = otp; // pre('save') hook hashes this
    user.otpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
    await user.save();

    await sendOtpEmail(user.email, otp);

    // Mask the email so the UI can show "sent to bi***@gmail.com" without fully
    // re-displaying it.
    const maskedEmail = user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2');

    res.status(200).json({
      success: true,
      message: `Verification code sent to ${maskedEmail}`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Self-service update of the logged-in user's own phone/email/password
//          and security question. Requires the current password, so anyone who
//          gets hold of a logged-in session still can't silently take over the
//          account's credentials. Changing the phone number or password ALSO
//          requires a fresh OTP from POST /request-otp — email-only changes
//          don't need one.
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
      otp,
    } = req.body;

    if (!currentPassword) {
      res.statusCode = 400;
      throw new Error('Please enter your current password to confirm changes');
    }

    const user = await User.findById(req.user._id).select('+otpHash +otpExpires');
    if (!user || !(await user.matchPassword(currentPassword))) {
      res.statusCode = 401;
      throw new Error('Current password is incorrect');
    }

    const phoneIsChanging = newPhone && newPhone.trim() !== user.phone;
    const passwordIsChanging = Boolean(newPassword);

    if (phoneIsChanging || passwordIsChanging) {
      if (!otp) {
        res.statusCode = 400;
        throw new Error('Please request and enter the verification code emailed to you before changing your phone or password');
      }
      if (!(await user.matchOtp(otp))) {
        res.statusCode = 401;
        throw new Error('Verification code is incorrect or has expired. Please request a new one.');
      }
      // Single use — clear it now so the same code can't be replayed.
      user.otpHash = null;
      user.otpExpires = null;
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
  requestOtp,
  updateCredentials,
  getSecurityQuestion,
  resetPasswordWithSecurityAnswer,
};
