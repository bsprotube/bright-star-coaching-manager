const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a batch name'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    schedule: {
      type: String, // e.g., "Mon-Fri 9:00 AM - 11:00 AM"
      trim: true,
    },
    classDays: {
      // Which weekdays this batch actually holds class, e.g. ["Mon", "Tue", "Wed", "Thu"]
      type: [String],
      enum: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    },
    monthlyFeeDefault: {
      type: Number,
      required: [true, 'Please add a default monthly fee'],
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Batch', batchSchema);