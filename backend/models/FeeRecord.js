const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
  },
  paymentDate: {
    type: Date,
    default: Date.now,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'card', 'bank_transfer'],
    default: 'cash',
    required: true,
  },
  transactionId: {
    type: String,
    trim: true,
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
});

const feeRecordSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    billingMonth: {
      type: String, // Format: YYYY-MM (e.g. "2026-06")
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    amountDue: {
      type: Number,
      required: true,
    },
    amountPaid: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ['paid', 'partial', 'pending'],
      default: 'pending',
      required: true,
    },
    payments: [paymentSchema],
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure a student has at most one fee invoice record per month
feeRecordSchema.index({ studentId: 1, billingMonth: 1 }, { unique: true });

module.exports = mongoose.model('FeeRecord', feeRecordSchema);
