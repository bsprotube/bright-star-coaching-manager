const express = require('express');
const router = express.Router();
const {
  createTest,
  getTests,
  getTestById,
  saveTestMarks,
  deleteTest,
  getBatchPerformance,
  getStudentPerformance,
} = require('../controllers/testController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { adminWriteLimiter } = require('../middleware/rateLimiters');
const { validate } = require('../middleware/validate');
const { testSchemas } = require('../middleware/schemas');

router.use(protect);

// Reports. These are declared before '/:id' so that "performance" and "student"
// aren't swallowed as test ids.
router.get(
  '/performance/:batchId',
  authorize('admin', 'teacher'),
  validate(testSchemas.batchIdParam),
  getBatchPerformance
);
router.get(
  '/student/:studentId',
  authorize('admin', 'teacher', 'student'),
  validate(testSchemas.studentIdParam),
  getStudentPerformance
);

router
  .route('/')
  .get(authorize('admin', 'teacher'), validate(testSchemas.list), getTests)
  .post(authorize('admin', 'teacher'), adminWriteLimiter, validate(testSchemas.create), createTest);

router
  .route('/:id')
  .get(authorize('admin', 'teacher'), validate(testSchemas.idParam), getTestById)
  .delete(authorize('admin'), adminWriteLimiter, validate(testSchemas.idParam), deleteTest);

router.put(
  '/:id/marks',
  authorize('admin', 'teacher'),
  adminWriteLimiter,
  validate(testSchemas.saveMarks),
  saveTestMarks
);

module.exports = router;
