const express = require('express');
const router = express.Router();
const {
  getBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
} = require('../controllers/batchController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { adminWriteLimiter } = require('../middleware/rateLimiters');
const { validate } = require('../middleware/validate');
const { batchSchemas } = require('../middleware/schemas');

router.use(protect);

router
  .route('/')
  .get(authorize('admin', 'teacher'), getBatches)
  .post(authorize('admin'), adminWriteLimiter, validate(batchSchemas.create), createBatch);

router
  .route('/:id')
  .get(authorize('admin', 'teacher'), validate(batchSchemas.idParam), getBatchById)
  .put(authorize('admin'), adminWriteLimiter, validate(batchSchemas.update), updateBatch)
  .delete(authorize('admin'), adminWriteLimiter, validate(batchSchemas.idParam), deleteBatch);

module.exports = router;
