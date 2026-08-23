const fs = require('fs');
const path = require('path');
const StudyFolder = require('../models/StudyFolder');
const StudyFile = require('../models/StudyFile');
const StudentDetail = require('../models/StudentDetail');
const Batch = require('../models/Batch');
const { UPLOADS_DIR } = require('../config/uploads');

// A student may only ever see the batch they're enrolled in — this app has no
// concept of a student belonging to more than one batch. Admins and teachers
// aren't restricted to a batch at all.
const assertCanReadBatch = async (user, batchId) => {
  if (user.role !== 'student') return;
  const detail = await StudentDetail.findOne({ userId: user._id });
  if (!detail || detail.batchId.toString() !== batchId.toString()) {
    const err = new Error('Not authorized to view this batch');
    err.statusCode = 403;
    throw err;
  }
};

// @desc    Create a folder (top-level, or nested under another folder in the
//          same batch)
// @route   POST /api/study-materials/folders
// @access  Private (Admin)
const createFolder = async (req, res, next) => {
  try {
    const { name, batchId, parentFolderId } = req.body;

    const batch = await Batch.findById(batchId);
    if (!batch) {
      res.statusCode = 400;
      throw new Error('Batch does not exist');
    }

    if (parentFolderId) {
      const parent = await StudyFolder.findById(parentFolderId);
      // Refusing a mismatched batchId here, rather than just trusting the
      // client's batchId, is what keeps a folder from ever landing under a
      // parent from a different batch — which would otherwise let its files
      // leak into the wrong batch's listing.
      if (!parent || parent.batchId.toString() !== batchId) {
        res.statusCode = 400;
        throw new Error('Parent folder does not exist in this batch');
      }
    }

    const folder = await StudyFolder.create({
      name: name.trim(),
      batchId,
      parentFolder: parentFolderId || null,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: folder });
  } catch (error) {
    next(error);
  }
};

// @desc    List the subfolders and files directly inside one folder (or, with
//          no parentFolderId, the batch's top-level folders and files)
// @route   GET /api/study-materials?batchId=&parentFolderId=
// @access  Private (Admin, Teacher, or a Student in this batch)
const listContents = async (req, res, next) => {
  try {
    const { batchId, parentFolderId } = req.query;
    await assertCanReadBatch(req.user, batchId);

    // `folder` is a required field on StudyFile, so no file ever has folder =
    // null — querying with parent = null at the root correctly returns no
    // files there without needing a special case.
    const parent = parentFolderId || null;
    const [folders, filesAtLevel] = await Promise.all([
      StudyFolder.find({ batchId, parentFolder: parent }).sort({ name: 1 }),
      StudyFile.find({ batchId, folder: parent }).sort({ name: 1 }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        folders: folders.map((f) => ({ id: f._id, name: f.name, createdAt: f.createdAt })),
        files: filesAtLevel.map((f) => ({
          id: f._id,
          name: f.name,
          fileSize: f.fileSize,
          createdAt: f.createdAt,
        })),
      },
    });
  } catch (error) {
    // assertCanReadBatch throws a plain Error with .statusCode (it has no `res`
    // to set res.statusCode on directly, unlike the rest of this file's
    // controllers) — propagate it here so a permission failure surfaces as 403,
    // not the errorHandler's default 500.
    if (error.statusCode) res.statusCode = error.statusCode;
    next(error);
  }
};

// @desc    Upload a PDF into a folder
// @route   POST /api/study-materials/files
// @access  Private (Admin)
const uploadFile = async (req, res, next) => {
  let savedPath = null;
  try {
    const { folderId, batchId } = req.body;

    if (!req.file) {
      res.statusCode = 400;
      throw new Error('Please choose a PDF to upload');
    }
    savedPath = req.file.path;

    const folder = await StudyFolder.findById(folderId);
    if (!folder || folder.batchId.toString() !== batchId) {
      res.statusCode = 400;
      throw new Error('Folder does not exist in this batch');
    }

    const file = await StudyFile.create({
      // Falls back to the uploaded filename (minus extension) so a teacher who
      // doesn't bother typing a label still gets something readable instead of
      // a blank entry.
      name: (req.body.name && req.body.name.trim()) || path.parse(req.file.originalname).name,
      folder: folderId,
      batchId,
      storedFilename: req.file.filename,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      data: { id: file._id, name: file.name, fileSize: file.fileSize },
    });
  } catch (error) {
    // Same rollback pattern as student photo upload: don't leave an orphaned
    // file on disk if the DB write that was supposed to reference it failed.
    if (savedPath) {
      fs.unlink(savedPath, () => {});
    }
    next(error);
  }
};

// @desc    Stream a study PDF to whoever is allowed to see its batch
// @route   GET /api/study-materials/files/:id/download
// @access  Private (Admin, Teacher, or a Student in this file's batch)
const downloadFile = async (req, res, next) => {
  try {
    const file = await StudyFile.findById(req.params.id);
    if (!file) {
      res.statusCode = 404;
      throw new Error('File not found');
    }
    await assertCanReadBatch(req.user, file.batchId);

    const diskPath = path.join(UPLOADS_DIR, file.storedFilename);
    if (!fs.existsSync(diskPath)) {
      res.statusCode = 404;
      throw new Error('File is missing on the server');
    }

    res.download(diskPath, `${file.name}.pdf`);
  } catch (error) {
    if (error.statusCode) res.statusCode = error.statusCode;
    next(error);
  }
};

// @desc    Delete a folder and everything inside it, recursively
// @route   DELETE /api/study-materials/folders/:id
// @access  Private (Admin)
const deleteFolder = async (req, res, next) => {
  try {
    const rootId = req.params.id;
    const root = await StudyFolder.findById(rootId);
    if (!root) {
      res.statusCode = 404;
      throw new Error('Folder not found');
    }

    // Breadth-first collection of every descendant folder. Depth is small in
    // practice (a subject broken into a few chapters), so this is a handful of
    // queries, not a concern — but it has to be a loop rather than one query
    // since Mongo can't walk a self-referencing tree in a single call.
    const allFolderIds = [rootId];
    let frontier = [rootId];
    while (frontier.length > 0) {
      const children = await StudyFolder.find({ parentFolder: { $in: frontier } }, '_id');
      const childIds = children.map((c) => c._id.toString());
      allFolderIds.push(...childIds);
      frontier = childIds;
    }

    const filesToDelete = await StudyFile.find({ folder: { $in: allFolderIds } });
    for (const file of filesToDelete) {
      fs.unlink(path.join(UPLOADS_DIR, file.storedFilename), () => {});
    }

    await StudyFile.deleteMany({ folder: { $in: allFolderIds } });
    await StudyFolder.deleteMany({ _id: { $in: allFolderIds } });

    res.status(200).json({
      success: true,
      message: `Folder deleted, along with ${allFolderIds.length - 1} subfolder(s) and ${filesToDelete.length} file(s)`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a single file
// @route   DELETE /api/study-materials/files/:id
// @access  Private (Admin)
const deleteFile = async (req, res, next) => {
  try {
    const file = await StudyFile.findById(req.params.id);
    if (!file) {
      res.statusCode = 404;
      throw new Error('File not found');
    }

    fs.unlink(path.join(UPLOADS_DIR, file.storedFilename), () => {});
    await file.deleteOne();

    res.status(200).json({ success: true, message: 'File deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFolder,
  listContents,
  uploadFile,
  downloadFile,
  deleteFolder,
  deleteFile,
};
