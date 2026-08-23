const mongoose = require('mongoose');

// A folder of study notes scoped to one batch. Nesting is via parentFolder
// (null = a top-level folder in the batch), so "Indian GK" > "Indian History"
// is just two documents linked by that field rather than a separate tree
// structure to keep in sync.
const studyFolderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a folder name'],
      trim: true,
      maxlength: 100,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true,
    },
    parentFolder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyFolder',
      default: null,
      index: true,
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

module.exports = mongoose.model('StudyFolder', studyFolderSchema);
