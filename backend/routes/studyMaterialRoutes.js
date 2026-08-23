const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  createFolder,
  listContents,
  uploadFile,
  downloadFile,
  deleteFolder,
  deleteFile,
} = require('../controllers/studyMaterialController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { adminWriteLimiter } = require('../middleware/rateLimiters');
const { validate } = require('../middleware/validate');
const { studyMaterialSchemas } = require('../middleware/schemas');
const { UPLOADS_DIR } = require('../config/uploads');

// Separate multer instance from studentRoutes': study notes are PDFs, not
// images, and run meaningfully larger (a scanned chapter can be several MB
// where a photo is capped at 2MB), so the file filter and size limit both
// need to differ from the photo-upload config.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'material-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const isPdf =
    path.extname(file.originalname).toLowerCase() === '.pdf' &&
    file.mimetype === 'application/pdf';
  if (isPdf) return cb(null, true);
  cb(new Error('Only PDF files are allowed'));
};

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB — a scanned chapter, not a textbook
  fileFilter,
});

router.use(protect);

router.post(
  '/folders',
  authorize('admin'),
  adminWriteLimiter,
  validate(studyMaterialSchemas.createFolder),
  createFolder
);

router.delete(
  '/folders/:id',
  authorize('admin'),
  adminWriteLimiter,
  validate(studyMaterialSchemas.idParam),
  deleteFolder
);

router.get(
  '/',
  authorize('admin', 'teacher', 'student'),
  validate(studyMaterialSchemas.listContents),
  listContents
);

router.post(
  '/files',
  authorize('admin'),
  adminWriteLimiter,
  upload.single('file'),
  validate(studyMaterialSchemas.uploadFile),
  uploadFile
);

router.get(
  '/files/:id/download',
  authorize('admin', 'teacher', 'student'),
  validate(studyMaterialSchemas.idParam),
  downloadFile
);

router.delete(
  '/files/:id',
  authorize('admin'),
  adminWriteLimiter,
  validate(studyMaterialSchemas.idParam),
  deleteFile
);

module.exports = router;
