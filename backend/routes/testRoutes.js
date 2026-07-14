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

router.use(protect);

// Reports. These are declared before '/:id' so that "performance" and "student"
// aren't swallowed as test ids.
router.get('/performance/:batchId', authorize('admin', 'teacher'), getBatchPerformance);
router.get('/student/:studentId', authorize('admin', 'teacher', 'student'), getStudentPerformance);

router
  .route('/')
  .get(authorize('admin', 'teacher'), getTests)
  .post(authorize('admin', 'teacher'), createTest);

router
  .route('/:id')
  .get(authorize('admin', 'teacher'), getTestById)
  .delete(authorize('admin'), deleteTest);

router.put('/:id/marks', authorize('admin', 'teacher'), saveTestMarks);

module.exports = router;
