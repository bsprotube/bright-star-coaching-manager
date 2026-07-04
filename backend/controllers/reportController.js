const User = require('../models/User');
const StudentDetail = require('../models/StudentDetail');
const Batch = require('../models/Batch');
const AttendanceRecord = require('../models/AttendanceRecord');
const FeeRecord = require('../models/FeeRecord');
const { buildPdfReport, buildExcelReport } = require('../services/exportService');

// Helper: Stream response file to client
const sendFileResponse = (res, buffer, format, filename) => {
  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  } else if (format === 'excel') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  }
  return res.end(buffer);
};

// @desc    Daily Attendance Report
// @route   GET /api/reports/daily-attendance
// @access  Private (Admin, Teacher)
const getDailyAttendanceReport = async (req, res, next) => {
  try {
    const { batchId } = req.query;
    const dateStr = req.query.date || new Date().toISOString().substring(0, 10);
    const format = req.query.format || 'json'; // json, pdf, excel

    if (!batchId) {
      res.statusCode = 400;
      throw new Error('Please specify a batch ID');
    }

    const batch = await Batch.findById(batchId);
    if (!batch) {
      res.statusCode = 404;
      throw new Error('Batch not found');
    }

    // Fetch batch students & attendance records
    const students = await StudentDetail.find({ batchId }).populate('userId', 'name phone');
    const records = await AttendanceRecord.find({ batchId, date: dateStr });
    const recordMap = records.reduce((map, r) => {
      map[r.studentId.toString()] = r;
      return map;
    }, {});

    const reportData = students.map((s) => {
      const rec = recordMap[s.userId._id.toString()];
      return {
        rollNumber: s.rollNumber,
        name: s.userId.name,
        phone: s.userId.phone,
        status: rec ? rec.status.toUpperCase() : 'ABSENT (UNMARKED)',
        time: rec ? new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        markedBy: rec ? rec.markedBy.toUpperCase() : 'N/A',
      };
    });

    if (format === 'json') {
      return res.status(200).json({ success: true, date: dateStr, batch: batch.name, data: reportData });
    }

    // PDF/Excel builds
    const title = 'Daily Attendance Report';
    const headers = ['Roll Number', 'Name', 'Phone', 'Status', 'Time', 'Marked By'];
    const rows = reportData.map(d => [d.rollNumber, d.name, d.phone, d.status, d.time, d.markedBy]);
    const metadata = {
      'Batch Name': batch.name,
      'Date': dateStr,
      'Total Enrolled': students.length,
      'Total Present': records.filter(r => r.status === 'present').length,
      'Total Late': records.filter(r => r.status === 'late').length,
    };

    let buffer;
    if (format === 'pdf') {
      buffer = await buildPdfReport(title, headers, rows, metadata);
    } else {
      buffer = await buildExcelReport(title, headers, rows, metadata);
    }

    return sendFileResponse(res, buffer, format, `Daily_Attendance_${batch.name}_${dateStr}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Monthly Attendance Report Grid Summary
// @route   GET /api/reports/monthly-attendance
// @access  Private (Admin, Teacher)
const getMonthlyAttendanceReport = async (req, res, next) => {
  try {
    const { batchId } = req.query;
    const monthStr = req.query.month || new Date().toISOString().substring(0, 7); // YYYY-MM
    const format = req.query.format || 'json';

    if (!batchId) {
      res.statusCode = 400;
      throw new Error('Please specify a batch ID');
    }

    const batch = await Batch.findById(batchId);
    if (!batch) {
      res.statusCode = 404;
      throw new Error('Batch not found');
    }

    const students = await StudentDetail.find({ batchId }).populate('userId', 'name');
    const studentIds = students.map(s => s.userId._id);

    // Get all records in the specified YYYY-MM month
    const startPattern = new RegExp(`^${monthStr}`);
    const records = await AttendanceRecord.find({
      studentId: { $in: studentIds },
      date: { $regex: startPattern },
    });

    const reportData = students.map((s) => {
      const studentRecs = records.filter(r => r.studentId.toString() === s.userId._id.toString());
      const presentCount = studentRecs.filter(r => r.status === 'present').length;
      const lateCount = studentRecs.filter(r => r.status === 'late').length;
      const absentCount = studentRecs.filter(r => r.status === 'absent').length;
      const totalSessions = studentRecs.length;
      const attendancePct = totalSessions > 0 ? Math.round(((presentCount + lateCount) / totalSessions) * 100) : 100;

      return {
        rollNumber: s.rollNumber,
        name: s.userId.name,
        presents: presentCount,
        lates: lateCount,
        absents: absentCount,
        percentage: `${attendancePct}%`,
      };
    });

    if (format === 'json') {
      return res.status(200).json({ success: true, month: monthStr, batch: batch.name, data: reportData });
    }

    const title = 'Monthly Attendance Summary';
    const headers = ['Roll Number', 'Name', 'Presents', 'Lates', 'Absents', 'Percentage %'];
    const rows = reportData.map(d => [d.rollNumber, d.name, d.presents, d.lates, d.absents, d.percentage]);
    const metadata = {
      'Batch Name': batch.name,
      'Billing Month': monthStr,
      'Total Students Checked': students.length,
    };

    let buffer;
    if (format === 'pdf') {
      buffer = await buildPdfReport(title, headers, rows, metadata);
    } else {
      buffer = await buildExcelReport(title, headers, rows, metadata);
    }

    return sendFileResponse(res, buffer, format, `Monthly_Attendance_${batch.name}_${monthStr}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Fee Due Report
// @route   GET /api/reports/fee-due
// @access  Private (Admin)
const getFeeDueReport = async (req, res, next) => {
  try {
    const monthStr = req.query.month || new Date().toISOString().substring(0, 7);
    const format = req.query.format || 'json';

    // Fetch fee records for this billing month
    const feeRecords = await FeeRecord.find({
      billingMonth: monthStr,
      status: { $in: ['pending', 'partial'] },
    }).populate('studentId', 'name phone');

    const studentUserIds = feeRecords.map(f => f.studentId._id);
    const details = await StudentDetail.find({ userId: { $in: studentUserIds } }).populate('batchId', 'name');
    const detailMap = details.reduce((map, d) => {
      map[d.userId.toString()] = d;
      return map;
    }, {});

    const reportData = feeRecords.map((f) => {
      const det = detailMap[f.studentId._id.toString()];
      return {
        rollNumber: det ? det.rollNumber : 'N/A',
        name: f.studentId.name,
        phone: f.studentId.phone,
        batch: det && det.batchId ? det.batchId.name : 'N/A',
        dueAmount: f.amountDue,
        paidAmount: f.amountPaid,
        pendingAmount: f.amountDue - f.amountPaid,
        status: f.status.toUpperCase(),
      };
    });

    if (format === 'json') {
      return res.status(200).json({ success: true, month: monthStr, data: reportData });
    }

    const title = 'Unpaid Fees Due Report';
    const headers = ['Roll Number', 'Name', 'Phone', 'Batch', 'Fee Due', 'Paid', 'Balance Dues', 'Status'];
    const rows = reportData.map(d => [d.rollNumber, d.name, d.phone, d.batch, d.dueAmount, d.paidAmount, d.pendingAmount, d.status]);
    const metadata = {
      'Billing Cycle': monthStr,
      'Total Unpaid Invoices': feeRecords.length,
      'Total Pending Revenue': reportData.reduce((acc, d) => acc + d.pendingAmount, 0),
    };

    let buffer;
    if (format === 'pdf') {
      buffer = await buildPdfReport(title, headers, rows, metadata);
    } else {
      buffer = await buildExcelReport(title, headers, rows, metadata);
    }

    return sendFileResponse(res, buffer, format, `Fee_Dues_Report_${monthStr}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Fee Collection Report (Receipt logs within range)
// @route   GET /api/reports/fee-collection
// @access  Private (Admin)
const getFeeCollectionReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const format = req.query.format || 'json';

    if (!startDate || !endDate) {
      res.statusCode = 400;
      throw new Error('Please specify both startDate and endDate (YYYY-MM-DD)');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // ensure inclusive of last millisecond of end date

    // Retrieve fee records that contain payments within the range
    const feeRecords = await FeeRecord.find({
      'payments.paymentDate': { $gte: start, $lte: end },
    }).populate('studentId', 'name');

    // Extract individual matching payments
    const collections = [];
    feeRecords.forEach((record) => {
      record.payments.forEach((p) => {
        if (p.paymentDate >= start && p.paymentDate <= end) {
          collections.push({
            date: p.paymentDate.toISOString().substring(0, 10),
            name: record.studentId.name,
            billingMonth: record.billingMonth,
            amount: p.amount,
            method: p.paymentMethod.toUpperCase(),
            txId: p.transactionId || 'CASH/DIRECT',
          });
        }
      });
    });

    // Sort chronologically
    collections.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (format === 'json') {
      return res.status(200).json({ success: true, startDate, endDate, data: collections });
    }

    const title = 'Fee Collections Log Report';
    const headers = ['Date', 'Student Name', 'Billing Month', 'Amount Paid', 'Payment Method', 'Transaction ID'];
    const rows = collections.map(c => [c.date, c.name, c.billingMonth, c.amount, c.method, c.txId]);
    const metadata = {
      'Date Range': `${startDate} to ${endDate}`,
      'Total Transactions': collections.length,
      'Total Revenue Collected': collections.reduce((acc, c) => acc + c.amount, 0),
    };

    let buffer;
    if (format === 'pdf') {
      buffer = await buildPdfReport(title, headers, rows, metadata);
    } else {
      buffer = await buildExcelReport(title, headers, rows, metadata);
    }

    return sendFileResponse(res, buffer, format, `Fee_Collections_${startDate}_to_${endDate}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Students Directory Report
// @route   GET /api/reports/students
// @access  Private (Admin, Teacher)
const getStudentsDirectoryReport = async (req, res, next) => {
  try {
    const { batchId } = req.query;
    const format = req.query.format || 'json';

    let batch = null;
    const detailQuery = {};
    if (batchId) {
      batch = await Batch.findById(batchId);
      if (!batch) {
        res.statusCode = 404;
        throw new Error('Batch not found');
      }
      detailQuery.batchId = batchId;
    }

    const students = await StudentDetail.find(detailQuery)
      .populate('userId', 'name phone email isActive')
      .populate('batchId', 'name');

    // Filter out inactive students for directory
    const activeStudents = students.filter(s => s.userId.isActive);

    const reportData = activeStudents.map((s) => ({
      rollNumber: s.rollNumber,
      name: s.userId.name,
      phone: s.userId.phone,
      parentPhone: s.parentPhone,
      batch: s.batchId ? s.batchId.name : 'N/A',
      fee: s.monthlyFee,
      admissionDate: s.admissionDate.toISOString().substring(0, 10),
      address: s.address,
    }));

    if (format === 'json') {
      return res.status(200).json({ success: true, data: reportData });
    }

    const title = 'Student Directory Report';
    const headers = ['Roll Number', 'Name', 'Phone', 'Parent Phone', 'Batch', 'Monthly Fee', 'Admit Date', 'Address'];
    const rows = reportData.map(d => [d.rollNumber, d.name, d.phone, d.parentPhone, d.batch, d.fee, d.admissionDate, d.address]);
    const metadata = {
      'Filtered Batch': batch ? batch.name : 'ALL BATCHES',
      'Total Count': activeStudents.length,
    };

    let buffer;
    if (format === 'pdf') {
      buffer = await buildPdfReport(title, headers, rows, metadata);
    } else {
      buffer = await buildExcelReport(title, headers, rows, metadata);
    }

    return sendFileResponse(res, buffer, format, `Student_Directory_${batch ? batch.name : 'All'}`);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDailyAttendanceReport,
  getMonthlyAttendanceReport,
  getFeeDueReport,
  getFeeCollectionReport,
  getStudentsDirectoryReport,
};
