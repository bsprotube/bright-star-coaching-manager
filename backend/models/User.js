const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Please add a phone number'],
      unique: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['admin', 'teacher', 'student'],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // "Forgot password" recovery — no email/SMS service is configured for this
    // app, so a security question is the zero-setup, zero-cost recovery path.
    // The question text is not sensitive (shown back to the user), so it's
    // stored plain; only the answer is hashed. select:false keeps the hash out
    // of normal queries so it's never accidentally sent to the client.
    securityQuestion: {
      type: String,
      trim: true,
      default: null,
    },
    securityAnswerHash: {
      type: String,
      select: false,
      default: null,
    },
    // One-time-password for the extra email-verification step required when
    // changing phone or password from Account Settings. Hashed the same way as
    // the password itself rather than stored plain, short-lived, and cleared
    // after a single successful use.
    otpHash: {
      type: String,
      select: false,
      default: null,
    },
    otpExpires: {
      type: Date,
      select: false,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt password (and, if set, hash the security answer / OTP) using bcrypt.
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  // Normalize (trim + lowercase) so answer matching isn't case/whitespace sensitive.
  if (this.isModified('securityAnswerHash') && this.securityAnswerHash) {
    const salt = await bcrypt.genSalt(10);
    this.securityAnswerHash = await bcrypt.hash(
      this.securityAnswerHash.trim().toLowerCase(),
      salt
    );
  }

  if (this.isModified('otpHash') && this.otpHash) {
    const salt = await bcrypt.genSalt(10);
    this.otpHash = await bcrypt.hash(this.otpHash, salt);
  }

  next();
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Match user entered security answer to the hashed answer in database
userSchema.methods.matchSecurityAnswer = async function (enteredAnswer) {
  if (!this.securityAnswerHash) return false;
  return await bcrypt.compare(
    String(enteredAnswer).trim().toLowerCase(),
    this.securityAnswerHash
  );
};

// Match user entered OTP to the hashed OTP in database, rejecting expired ones.
userSchema.methods.matchOtp = async function (enteredOtp) {
  if (!this.otpHash || !this.otpExpires) return false;
  if (this.otpExpires.getTime() < Date.now()) return false;
  return await bcrypt.compare(String(enteredOtp).trim(), this.otpHash);
};

module.exports = mongoose.model('User', userSchema);