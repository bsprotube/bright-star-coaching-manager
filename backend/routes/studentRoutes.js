const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { adminWriteLimiter } = require('../middleware/rateLimiters');
const { validate } = require('../middleware/validate');
const { studentSchemas } = require('../middleware/schemas');

// Multer storage engine configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/'); // files stored in uploads/ folder
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'student-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter (Images only)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only JPEG, JPG, and PNG images are allowed'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max size
  fileFilter,
});

router.use(protect);

// Validation runs after multer on the multipart routes, since the body fields
// don't exist until multer has parsed the form.
router
  .route('/')
  .get(authorize('admin', 'teacher'), validate(studentSchemas.list), getStudents)
  .post(
    authorize('admin'),
    adminWriteLimiter,
    upload.single('photo'),
    validate(studentSchemas.create),
    createStudent
  );

router
  .route('/:id')
  .get(authorize('admin', 'teacher', 'student'), validate(studentSchemas.byId), getStudentById)
  .put(
    authorize('admin'),
    adminWriteLimiter,
    upload.single('photo'),
    validate(studentSchemas.update),
    updateStudent
  )
  .delete(authorize('admin'), adminWriteLimiter, validate(studentSchemas.idParam), deleteStudent);

module.exports = router;
