const mongoose = require('mongoose');

// A single uploaded PDF. batchId is duplicated from the parent folder (rather
// than looked up through it on every access check) so a student's read
// permission can be checked with one field comparison instead of walking the
// folder chain — and so a file can never end up readable under the wrong
// batch even if its folder were somehow moved later.
const studyFileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a file name'],
      trim: true,
      maxlength: 150,
    },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyFolder',
      required: true,
      index: true,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true,
    },
    storedFilename: {
      // The name on disk (multer-generated, unguessable) — kept separate from
      // `name` so the on-disk name never has to match whatever a student-facing
      // label gets renamed to.
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('StudyFile', studyFileSchema);
