const mongoose = require('mongoose');

// One student's marks in one subject of one test. `maxMarks` is copied from the test's
// subject definition at save time so that a later edit to the test can never silently
// change what a student was actually scored out of.
const subjectMarkSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    marksObtained: {
      type: Number,
      required: true,
      min: 0,
    },
    maxMarks: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const testResultSchema = new mongoose.Schema(
  {
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    marks: {
      type: [subjectMarkSchema],
      default: [],
    },
    // Denormalised totals, recomputed on every save (see pre-validate hook below), so
    // ranking and performance queries don't have to sum subject arrays in memory.
    totalObtained: {
      type: Number,
      required: true,
      default: 0,
    },
    totalMaxMarks: {
      type: Number,
      required: true,
      default: 0,
    },
    percentage: {
      type: Number,
      required: true,
      default: 0,
    },
    // Set when the student was absent for the test — kept out of averages and ranking
    // instead of being counted as a zero, which would unfairly wreck their average.
    isAbsent: {
      type: Boolean,
      default: false,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// A student has at most one result per test.
testResultSchema.index({ testId: 1, studentId: 1 }, { unique: true });
testResultSchema.index({ studentId: 1 });

testResultSchema.pre('validate', function recomputeTotals(next) {
  const marks = this.marks || [];
  this.totalObtained = marks.reduce((sum, m) => sum + (m.marksObtained || 0), 0);
  this.totalMaxMarks = marks.reduce((sum, m) => sum + (m.maxMarks || 0), 0);
  this.percentage =
    this.totalMaxMarks > 0
      ? Math.round((this.totalObtained / this.totalMaxMarks) * 100)
      : 0;
  next();
});

module.exports = mongoose.model('TestResult', testResultSchema);
