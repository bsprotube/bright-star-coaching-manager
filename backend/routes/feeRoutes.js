const express = require('express');
const router = express.Router();
const {
  getDues,
  getStudentFees,
  recordPayment,
  triggerBilling,
} = require('../controllers/feeController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/dues', authorize('admin'), getDues);
router.get('/student/:studentId', authorize('admin', 'student'), getStudentFees);
router.post('/payment', authorize('admin'), recordPayment);
router.post('/trigger-billing', authorize('admin'), triggerBilling);

module.exports = router;
