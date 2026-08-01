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
const { validate } = require('../middleware/validate');
const { attendanceSchemas } = require('../middleware/schemas');

router.use(protect);

router.post(
  '/code/generate',
  authorize('admin', 'teacher'),
  validate(attendanceSchemas.generateCode),
  generateAttendanceCode
);
router.get(
  '/code/active/:batchId',
  authorize('admin', 'teacher', 'student'),
  validate(attendanceSchemas.batchIdParam),
  getActiveCode
);
router.post('/check-in', authorize('student'), validate(attendanceSchemas.checkIn), checkIn);
router.post(
  '/mark-manual',
  authorize('admin', 'teacher'),
  validate(attendanceSchemas.markManual),
  markManualAttendance
);
router.get(
  '/history/student/:studentId',
  authorize('admin', 'teacher', 'student'),
  validate(attendanceSchemas.studentIdParam),
  getStudentAttendanceHistory
);
router.get(
  '/history/batch/:batchId',
  authorize('admin', 'teacher'),
  validate(attendanceSchemas.batchIdParam),
  getBatchAttendanceHistory
);
router.get(
  '/register/:batchId',
  authorize('admin', 'teacher'),
  validate(attendanceSchemas.batchIdParam),
  getBatchMonthlyRegister
);

module.exports = router;
