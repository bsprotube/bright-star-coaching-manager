const FeeRecord = require('../models/FeeRecord');
const StudentDetail = require('../models/StudentDetail');
const User = require('../models/User');
const { generateDuesForAllActiveStudents } = require('../services/billingService');

// @desc    Get all students with pending/partial fees
// @route   GET /api/fees/dues
// @access  Private (Admin)
const getDues = async (req, res, next) => {
  try {
    // Auto-catchup: generate any missing billing cycles for every active student
    // (from their admission date up to today). This is what makes monthly fee
    // generation automatic — no manual "Trigger Billing" step needed anymore.
    await generateDuesForAllActiveStudents();

    const billingMonth = req.query.month || new Date().toISOString().substring(0, 7); // Default current month YYYY-MM
    
    // Find all partial/pending fee records for the month that are due
    // (dueDate <= now — with GRACE_PERIOD_DAYS = 0, this is immediate)
    const feeRecords = await FeeRecord.find({
      billingMonth,
      status: { $in: ['pending', 'partial'] },
      dueDate: { $lte: new Date() },
    }).populate('studentId', 'name phone');

    const studentIds = feeRecords.map(f => f.studentId._id);

    // Get batch information for these students
    const details = await StudentDetail.find({ userId: { $in: studentIds } }).populate('batchId', 'name');
    
    const detailMap = details.reduce((map, det) => {
      map[det.userId.toString()] = det;
      return map;
    }, {});

    const duesList = feeRecords.map(f => {
      const detail = detailMap[f.studentId._id.toString()];
      return {
        feeRecordId: f._id,
        studentId: f.studentId._id,
        name: f.studentId.name,
        phone: f.studentId.phone,
        rollNumber: detail ? detail.rollNumber : 'N/A',
        batchName: detail && detail.batchId ? detail.batchId.name : 'N/A',
        photoUrl: detail ? detail.photoUrl : '',
        amountDue: f.amountDue,
        amountPaid: f.amountPaid,
        status: f.status,
        dueDate: f.dueDate,
      };
    });

    res.status(200).json({
      success: true,
      month: billingMonth,
      count: duesList.length,
      data: duesList,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get fee ledger history for a student
// @route   GET /api/fees/student/:studentId
// @access  Private (Admin, Student)
const getStudentFees = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      res.statusCode = 403;
      throw new Error('Not authorized to access these fee records');
    }

    const records = await FeeRecord.find({ studentId }).sort({ billingMonth: -1 });

    res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Record transaction payment
// @route   POST /api/fees/payment
// @access  Private (Admin)
const recordPayment = async (req, res, next) => {
  try {
    const { feeRecordId, amount, paymentMethod, transactionId } = req.body;

    if (!feeRecordId || amount === undefined || amount <= 0) {
      res.statusCode = 400;
      throw new Error('Please specify fee record ID and a positive payment amount');
    }

    const feeRecord = await FeeRecord.findById(feeRecordId);
    if (!feeRecord) {
      res.statusCode = 404;
      throw new Error('Fee invoice record not found');
    }

    const totalAllowed = feeRecord.amountDue - feeRecord.amountPaid;
    if (amount > totalAllowed) {
      res.statusCode = 400;
      throw new Error(`Amount exceeds remaining balance. Max allowed: ${totalAllowed}`);
    }

    // Append transaction
    feeRecord.payments.push({
      amount: Number(amount),
      paymentMethod: paymentMethod || 'cash',
      transactionId,
      recordedBy: req.user._id,
    });

    // Update accumulators
    feeRecord.amountPaid += Number(amount);

    // Calculate Status
    if (feeRecord.amountPaid >= feeRecord.amountDue) {
      feeRecord.status = 'paid';
    } else {
      feeRecord.status = 'partial';
    }

    await feeRecord.save();

    res.status(200).json({
      success: true,
      message: 'Payment recorded successfully',
      data: feeRecord,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manually force a billing catch-up for all active students
//          (normal operation no longer needs this — getDues already auto-catches-up —
//          but it's kept as an admin "force refresh" option)
// @route   POST /api/fees/trigger-billing
// @access  Private (Admin)
const triggerBilling = async (req, res, next) => {
  try {
    const stats = await generateDuesForAllActiveStudents();

    res.status(200).json({
      success: true,
      message: 'Billing catch-up executed for all active students',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDues,
  getStudentFees,
  recordPayment,
  triggerBilling,
};
