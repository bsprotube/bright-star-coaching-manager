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
  },
  {
    timestamps: true,
  }
);

// Encrypt password (and, if set, hash the security answer) using bcrypt.
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

module.exports = mongoose.model('User', userSchema);