const express = require('express');
const router = express.Router();
const {
  getDailyAttendanceReport,
  getMonthlyAttendanceReport,
  getFeeDueReport,
  getFeeCollectionReport,
  getStudentsDirectoryReport,
} = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { reportSchemas } = require('../middleware/schemas');

router.use(protect);

router.get(
  '/daily-attendance',
  authorize('admin', 'teacher'),
  validate(reportSchemas.dailyAttendance),
  getDailyAttendanceReport
);
router.get(
  '/monthly-attendance',
  authorize('admin', 'teacher'),
  validate(reportSchemas.monthlyAttendance),
  getMonthlyAttendanceReport
);
router.get('/fee-due', authorize('admin'), validate(reportSchemas.feeDue), getFeeDueReport);
router.get(
  '/fee-collection',
  authorize('admin'),
  validate(reportSchemas.feeCollection),
  getFeeCollectionReport
);
router.get(
  '/students',
  authorize('admin', 'teacher'),
  validate(reportSchemas.studentsDirectory),
  getStudentsDirectoryReport
);

module.exports = router;
