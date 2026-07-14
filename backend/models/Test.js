const mongoose = require('mongoose');

// A test can cover one subject or several (e.g. an ADRE mock with Maths, Reasoning,
// GK, GS, English and Current Affairs sections). Each subject carries its own max
// marks, which is what lets us report per-subject strengths and weaknesses later.
const testSubjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a subject name'],
      trim: true,
    },
    maxMarks: {
      type: Number,
      required: [true, 'Please add max marks for the subject'],
      min: [1, 'Max marks must be at least 1'],
    },
  },
  { _id: false }
);

const testSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
    },
    title: {
      type: String, // e.g. "Unit Test 1", "ADRE Mock 3"
      required: [true, 'Please add a test title'],
      trim: true,
    },
    testDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    subjects: {
      type: [testSubjectSchema],
      validate: {
        validator: (subjects) => Array.isArray(subjects) && subjects.length > 0,
        message: 'A test needs at least one subject',
      },
    },
    // Sum of every subject's maxMarks. Denormalised so percentages can be computed
    // without re-reading the subject list on every query.
    totalMaxMarks: {
      type: Number,
      required: true,
      min: 1,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

testSchema.index({ batchId: 1, testDate: -1 });

module.exports = mongoose.model('Test', testSchema);
