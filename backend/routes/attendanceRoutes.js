const express = require('express');
const router = express.Router();
const {
  generateAttendanceCode,
  getActiveCode,
  checkIn,
  markManualAttendance,
  getStudentAttendanceHistory,
  getBatchAttendanceHistory,
  getBatchMonthlyRegister,
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/code/generate', authorize('admin', 'teacher'), generateAttendanceCode);
router.get('/code/active/:batchId', authorize('admin', 'teacher', 'student'), getActiveCode);
router.post('/check-in', authorize('student'), checkIn);
router.post('/mark-manual', authorize('admin', 'teacher'), markManualAttendance);
router.get('/history/student/:studentId', authorize('admin', 'teacher', 'student'), getStudentAttendanceHistory);
router.get('/history/batch/:batchId', authorize('admin', 'teacher'), getBatchAttendanceHistory);
router.get('/register/:batchId', authorize('admin', 'teacher'), getBatchMonthlyRegister);

module.exports = router;
