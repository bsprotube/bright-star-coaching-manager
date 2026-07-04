const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
    },
    date: {
      type: String, // Format: YYYY-MM-DD (e.g., "2026-06-23")
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    markedBy: {
      type: String,
      enum: ['self', 'teacher', 'admin'],
      required: true,
    },
    codeUsed: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late'],
      default: 'present',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to guarantee one attendance record per student per day
attendanceRecordSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
