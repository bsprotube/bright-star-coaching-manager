const Batch = require('../models/Batch');
const StudentDetail = require('../models/StudentDetail');

// @desc    Get all batches with student count
// @route   GET /api/batches
// @access  Private (Admin, Teacher)
const getBatches = async (req, res, next) => {
  try {
    const batches = await Batch.find({});
    
    // Aggregate student counts per batch
    const studentCounts = await StudentDetail.aggregate([
      {
        $group: {
          _id: '$batchId',
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = studentCounts.reduce((map, item) => {
      map[item._id.toString()] = item.count;
      return map;
    }, {});

    const batchesWithCounts = batches.map(batch => ({
      ...batch.toObject(),
      studentCount: countMap[batch._id.toString()] || 0,
    }));

    res.status(200).json({
      success: true,
      count: batchesWithCounts.length,
      data: batchesWithCounts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single batch
// @route   GET /api/batches/:id
// @access  Private (Admin, Teacher)
const getBatchById = async (req, res, next) => {
  try {
    const batch = await Batch.findById(req.params.id);

    if (!batch) {
      res.statusCode = 404;
      throw new Error(`Batch not found with ID: ${req.params.id}`);
    }

    const studentCount = await StudentDetail.countDocuments({ batchId: batch._id });

    res.status(200).json({
      success: true,
      data: {
        ...batch.toObject(),
        studentCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new batch
// @route   POST /api/batches
// @access  Private (Admin)
const createBatch = async (req, res, next) => {
  try {
    const { name, description, schedule, monthlyFeeDefault, classDays } = req.body;

    if (!name) {
      res.statusCode = 400;
      throw new Error('Please add a batch name');
    }

    const batchExists = await Batch.findOne({ name });
    if (batchExists) {
      res.statusCode = 400;
      throw new Error('A batch with this name already exists');
    }

    const batch = await Batch.create({
      name,
      description,
      schedule,
      monthlyFeeDefault,
      classDays, // Mongoose applies the schema default (Mon-Fri) if this is undefined
    });

    res.status(201).json({
      success: true,
      data: batch,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update batch
// @route   PUT /api/batches/:id
// @access  Private (Admin)
const updateBatch = async (req, res, next) => {
  try {
    const { name, description, schedule, monthlyFeeDefault, classDays } = req.body;

    let batch = await Batch.findById(req.params.id);
    if (!batch) {
      res.statusCode = 404;
      throw new Error(`Batch not found with ID: ${req.params.id}`);
    }

    // If changing name, ensure uniqueness
    if (name && name !== batch.name) {
      const nameExists = await Batch.findOne({ name });
      if (nameExists) {
        res.statusCode = 400;
        throw new Error('A batch with this name already exists');
      }
    }

    batch = await Batch.findByIdAndUpdate(
      req.params.id,
      { name, description, schedule, monthlyFeeDefault, classDays },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: batch,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete batch
// @route   DELETE /api/batches/:id
// @access  Private (Admin)
const deleteBatch = async (req, res, next) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      res.statusCode = 404;
      throw new Error(`Batch not found with ID: ${req.params.id}`);
    }

    // Check if students are assigned to this batch
    const studentsAssigned = await StudentDetail.countDocuments({ batchId: batch._id });
    if (studentsAssigned > 0) {
      res.statusCode = 400;
      throw new Error(`Cannot delete batch. There are ${studentsAssigned} student(s) enrolled in it.`);
    }

    await batch.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Batch removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
};
