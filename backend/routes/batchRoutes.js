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

router.use(protect);

router
  .route('/')
  .get(authorize('admin', 'teacher'), getBatches)
  .post(authorize('admin'), createBatch);

router
  .route('/:id')
  .get(authorize('admin', 'teacher'), getBatchById)
  .put(authorize('admin'), updateBatch)
  .delete(authorize('admin'), deleteBatch);

module.exports = router;
