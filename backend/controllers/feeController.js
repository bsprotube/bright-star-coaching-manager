const FeeRecord = require('../models/FeeRecord');
const StudentDetail = require('../models/StudentDetail');
const User = require('../models/User');
const { generateDuesForAllActiveStudents } = require('../services/billingService');

// @desc    Get all students with pending/partial fees
// @route   GET /api/fees/dues
// @access  Private (Admin)
const getDues = async (req, res, next) => {
  try {
    // NOTE: billing catch-up used to run here on every request, but with
    // enough students that became slow enough to time out (each student
    // needs several sequential DB round-trips). It now runs periodically in
    // the background instead (see server.js), so this endpoint just reads
    // whatever fee records already exist and responds immediately.

    // If a specific ?month=YYYY-MM is requested, scope to that month. Otherwise
    // aggregate EVERY outstanding invoice across all months — a student who owes
    // for several past months, or whose current month hasn't been billed yet by
    // the background job, must still count toward the dashboard's total. Scoping
    // to only the current month was making the dues show ₹0 / 0 invoices.
    const requestedMonth = req.query.month;

    const query = {
      status: { $in: ['pending', 'partial'] },
      dueDate: { $lte: new Date() },
    };
    if (requestedMonth) {
      query.billingMonth = requestedMonth;
    }

    const rawFeeRecords = await FeeRecord.find(query).populate('studentId', 'name phone');

    // Guard against orphaned fee records whose student no longer exists — with
    // populate() those come back with studentId === null and would crash below.
    const feeRecords = rawFeeRecords.filter(f => f.studentId);

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
      month: requestedMonth || 'all',
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

    // Convert once, up front, and validate the NUMBER — not the original value.
    // `"abc" <= 0` evaluates to false in JS (a NaN comparison), so checking the raw
    // input let a non-numeric amount slip past this guard and turn amountPaid into
    // NaN a few lines down, permanently corrupting the invoice.
    const numericAmount = Number(amount);
    if (!feeRecordId || amount === undefined || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      res.statusCode = 400;
      throw new Error('Please specify fee record ID and a positive payment amount');
    }

    const feeRecord = await FeeRecord.findById(feeRecordId);
    if (!feeRecord) {
      res.statusCode = 404;
      throw new Error('Fee invoice record not found');
    }

    const totalAllowed = feeRecord.amountDue - feeRecord.amountPaid;
    if (numericAmount > totalAllowed) {
      res.statusCode = 400;
      throw new Error(`Amount exceeds remaining balance. Max allowed: ${totalAllowed}`);
    }

    // Append transaction
    feeRecord.payments.push({
      amount: numericAmount,
      paymentMethod: paymentMethod || 'cash',
      transactionId,
      recordedBy: req.user._id,
    });

    // Update accumulators
    feeRecord.amountPaid += numericAmount;

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