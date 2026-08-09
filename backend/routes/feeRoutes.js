const express = require('express');
const router = express.Router();
const {
  getDues,
  getStudentFees,
  recordPayment,
  updateFeeAmount,
  triggerBilling,
} = require('../controllers/feeController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { adminWriteLimiter } = require('../middleware/rateLimiters');
const { validate } = require('../middleware/validate');
const { feeSchemas } = require('../middleware/schemas');

router.use(protect);

router.get('/dues', authorize('admin'), validate(feeSchemas.dues), getDues);
router.get(
  '/student/:studentId',
  authorize('admin', 'student'),
  validate(feeSchemas.studentIdParam),
  getStudentFees
);
router.post(
  '/payment',
  authorize('admin'),
  adminWriteLimiter,
  validate(feeSchemas.payment),
  recordPayment
);
router.put(
  '/:feeRecordId/amount',
  authorize('admin'),
  adminWriteLimiter,
  validate(feeSchemas.updateAmount),
  updateFeeAmount
);

router.post(
  '/trigger-billing',
  authorize('admin'),
  adminWriteLimiter,
  validate(feeSchemas.triggerBilling),
  triggerBilling
);

module.exports = router;
