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

router.use(protect);

router.get('/daily-attendance', authorize('admin', 'teacher'), getDailyAttendanceReport);
router.get('/monthly-attendance', authorize('admin', 'teacher'), getMonthlyAttendanceReport);
router.get('/fee-due', authorize('admin'), getFeeDueReport);
router.get('/fee-collection', authorize('admin'), getFeeCollectionReport);
router.get('/students', authorize('admin', 'teacher'), getStudentsDirectoryReport);

module.exports = router;
