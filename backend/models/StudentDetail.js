const mongoose = require('mongoose');

const studentDetailSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    rollNumber: {
      type: String,
      required: [true, 'Please add a roll number'],
      unique: true,
      trim: true,
      index: true,
    },
    parentPhone: {
      type: String,
      required: [true, 'Please add a parent phone number'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Please add an address'],
      trim: true,
    },
    admissionDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    monthlyFee: {
      type: Number,
      required: [true, 'Please add a monthly fee amount'],
    },
    admissionFee: {
      type: Number,
      required: [true, 'Please add an admission fee amount'],
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: [true, 'Please assign a batch'],
    },
    photoUrl: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('StudentDetail', studentDetailSchema);
