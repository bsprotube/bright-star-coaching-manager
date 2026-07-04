const AttendanceCode = require('../models/AttendanceCode');
const AttendanceRecord = require('../models/AttendanceRecord');
const StudentDetail = require('../models/StudentDetail');
const User = require('../models/User');
const FeeRecord = require('../models/FeeRecord');
const Batch = require('../models/Batch');

// Marks every active student in a batch who has no attendance record yet for
// the given date as "absent". Safe to call multiple times — it only creates
// records for students who are still unmarked, so it never overwrites a
// present/late/manual entry.
const autoMarkAbsentees = async (batchId, dateStr) => {
  const studentsInBatch = await StudentDetail.find({ batchId }).populate('userId', 'isActive');
  const existingRecords = await AttendanceRecord.find({ batchId, date: dateStr });
  const markedIds = new Set(existingRecords.map((r) => r.studentId.toString()));

  const toCreate = studentsInBatch
    .filter((s) => s.userId && s.userId.isActive && !markedIds.has(s.userId._id.toString()))
    .map((s) => ({
      studentId: s.userId._id,
      batchId,
      date: dateStr,
      status: 'absent',
      markedBy: 'system',
      timestamp: new Date(),
    }));

  if (toCreate.length > 0) {
    await AttendanceRecord.insertMany(toCreate);
  }
};

// Finalizes every expired attendance code for one specific batch (there can
// be more than one stale, un-finalized code lying around if several were
// generated back-to-back without the scheduler catching them in between).
// Marks absentees for each one's date, then removes them.
const finalizeExpiredCodesForBatch = async (batchId) => {
  const expiredCodes = await AttendanceCode.find({ batchId, expiresAt: { $lte: new Date() } });

  for (const codeDoc of expiredCodes) {
    try {
      const dateStr = codeDoc.expiresAt.toISOString().substring(0, 10);
      await autoMarkAbsentees(batchId, dateStr);
      await AttendanceCode.deleteOne({ _id: codeDoc._id });
    } catch (err) {
      console.error(`Failed to finalize expired code for batch ${batchId}: ${err.message}`);
    }
  }
};

// Scans every attendance code across all batches that has already expired,
// auto-marks absentees for that batch/date, then removes the stale code.
// This is called on a timer by server.js so absent-marking happens
// automatically the moment a code's countdown hits zero — nobody needs to
// have the app open.
const finalizeAllExpiredCodes = async () => {
  const batchIds = await AttendanceCode.distinct('batchId', { expiresAt: { $lte: new Date() } });
  for (const batchId of batchIds) {
    await finalizeExpiredCodesForBatch(batchId);
  }
};

// @desc    Generate daily attendance code
// @route   POST /api/attendance/code/generate
// @access  Private (Admin, Teacher)
const generateAttendanceCode = async (req, res, next) => {
  try {
    const { batchId, code, expiryMinutes } = req.body;

    if (!batchId) {
      res.statusCode = 400;
      throw new Error('Please specify a batch ID');
    }

    // Before wiping any existing codes, finalize ALL of this batch's expired
    // ones (not just one) — otherwise older un-finalized codes would be lost
    // without ever marking their absentees.
    await finalizeExpiredCodesForBatch(batchId);

    // Generate random 2-digit code if not provided
    let attendanceCodeValue = code;
    if (!attendanceCodeValue) {
      attendanceCodeValue = Math.floor(10 + Math.random() * 90).toString(); // Generates 10-99
    }

    const duration = expiryMinutes ? parseInt(expiryMinutes) : 15; // default 15 mins expiry
    const expiresAt = new Date(Date.now() + duration * 60 * 1000);

    // Delete any active codes for this batch first
    await AttendanceCode.deleteMany({ batchId });

    const activeCode = await AttendanceCode.create({
      code: attendanceCodeValue,
      batchId,
      generatedBy: req.user._id,
      expiresAt,
    });

    res.status(201).json({
      success: true,
      data: {
        code: activeCode.code,
        expiresAt: activeCode.expiresAt,
        batchId: activeCode.batchId,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get active code for a batch
// @route   GET /api/attendance/code/active/:batchId
// @access  Private (Admin, Teacher, Student)
const getActiveCode = async (req, res, next) => {
  try {
    const batchId = req.params.batchId;
    const activeCode = await AttendanceCode.findOne({
      batchId,
      expiresAt: { $gt: new Date() },
    });

    if (!activeCode) {
      // No currently-active code. Finalize any/all expired codes for this
      // batch that haven't been cleaned up yet.
      await finalizeExpiredCodesForBatch(batchId);
    }

    res.status(200).json({
      success: true,
      active: !!activeCode,
      expiresAt: activeCode ? activeCode.expiresAt : null,
      // Hide code for students to prevent sharing, but allow check-in endpoints to use it under the hood.
      // Admin/Teacher can view the code.
      code: activeCode && req.user.role !== 'student' ? activeCode.code : null,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Student Check-in with Code
// @route   POST /api/attendance/check-in
// @access  Private (Student)
const checkIn = async (req, res, next) => {
  try {
    const { batchId, code } = req.body;
    const studentId = req.user._id;

    if (!batchId || !code) {
      res.statusCode = 400;
      throw new Error('Please provide both batch ID and code');
    }

    // 1. Verify student belongs to this batch
    const studentDetail = await StudentDetail.findOne({ userId: studentId });
    if (!studentDetail) {
      res.statusCode = 404;
      throw new Error('Student profile details not found');
    }

    if (studentDetail.batchId.toString() !== batchId) {
      res.statusCode = 400;
      throw new Error('You are not assigned to this batch');
    }

    // 2. Find active code matching parameters
    const activeCode = await AttendanceCode.findOne({
      batchId,
      code,
      expiresAt: { $gt: new Date() },
    });

    if (!activeCode) {
      res.statusCode = 400;
      throw new Error('Invalid or expired attendance code');
    }

    // 3. Check if already checked in today
    const todayStr = new Date().toISOString().substring(0, 10); // "YYYY-MM-DD"
    const existingRecord = await AttendanceRecord.findOne({
      studentId,
      date: todayStr,
    });

    if (existingRecord) {
      res.statusCode = 400;
      throw new Error('You have already marked attendance for today');
    }

    // 4. Create record
    const record = await AttendanceRecord.create({
      studentId,
      batchId,
      date: todayStr,
      markedBy: 'self',
      codeUsed: code,
      status: 'present',
    });

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: record,
    });
  } catch (error) {
    // Handle Mongoose duplicate compound key just in case
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already marked attendance for today',
      });
    }
    next(error);
  }
};

// @desc    Manually mark/override student attendance
// @route   POST /api/attendance/mark-manual
// @access  Private (Admin, Teacher)
const markManualAttendance = async (req, res, next) => {
  try {
    const { studentId, batchId, date, status } = req.body;

    if (!studentId || !batchId || !date || !status) {
      res.statusCode = 400;
      throw new Error('Please fill in student ID, batch ID, date, and status');
    }

    // Validate student and batch exist
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      res.statusCode = 404;
      throw new Error('Student not found');
    }

    // Upsert the attendance record for the date
    const record = await AttendanceRecord.findOneAndUpdate(
      { studentId, date },
      {
        batchId,
        markedBy: req.user.role,
        status,
        timestamp: new Date(), // update timestamp to manual overwrite
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: `Attendance marked as ${status} successfully`,
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student attendance history
// @route   GET /api/attendance/history/student/:studentId
// @access  Private (Admin, Teacher, Student)
const getStudentAttendanceHistory = async (req, res, next) => {
  try {
    const studentId = req.params.studentId;

    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      res.statusCode = 403;
      throw new Error('Not authorized to access these attendance logs');
    }

    const records = await AttendanceRecord.find({ studentId })
      .sort({ date: -1 })
      .populate('batchId', 'name');

    res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get batch attendance sheet for a date
// @route   GET /api/attendance/history/batch/:batchId
// @access  Private (Admin, Teacher)
const getBatchAttendanceHistory = async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const dateStr = req.query.date || new Date().toISOString().substring(0, 10); // defaults to today

    // Fetch all students enrolled in the batch
    const studentsInBatch = await StudentDetail.find({ batchId })
      .populate('userId', 'name phone');

    // Fetch attendance records for this batch and date
    const attendanceRecords = await AttendanceRecord.find({
      batchId,
      date: dateStr,
    });

    // Map records for quick lookup
    const recordMap = attendanceRecords.reduce((map, rec) => {
      map[rec.studentId.toString()] = rec;
      return map;
    }, {});

    // Fetch every pending/partial fee record for these students, so their
    // outstanding dues can be shown right alongside attendance marking.
    const studentUserIds = studentsInBatch.map((s) => s.userId._id);
    const pendingFees = await FeeRecord.find({
      studentId: { $in: studentUserIds },
      status: { $in: ['pending', 'partial'] },
    });

    const pendingFeeMap = pendingFees.reduce((map, fee) => {
      const sid = fee.studentId.toString();
      const outstanding = fee.amountDue - fee.amountPaid;
      if (!map[sid]) map[sid] = { totalDue: 0, monthsPending: 0 };
      map[sid].totalDue += outstanding;
      map[sid].monthsPending += 1;
      return map;
    }, {});

    // Construct full sheet
    const sheet = studentsInBatch.map(s => {
      const record = recordMap[s.userId._id.toString()];
      const feeInfo = pendingFeeMap[s.userId._id.toString()];
      return {
        studentId: s.userId._id,
        name: s.userId.name,
        phone: s.userId.phone,
        rollNumber: s.rollNumber,
        photoUrl: s.photoUrl,
        status: record ? record.status : 'unmarked', // present, absent, late, or unmarked
        markedBy: record ? record.markedBy : null,
        timestamp: record ? record.timestamp : null,
        pendingFeeAmount: feeInfo ? feeInfo.totalDue : 0,
        pendingFeeMonths: feeInfo ? feeInfo.monthsPending : 0,
      };
    });

    res.status(200).json({
      success: true,
      date: dateStr,
      count: sheet.length,
      data: sheet,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get full-month attendance register grid for a batch (all students x all days)
// @route   GET /api/attendance/register/:batchId?month=YYYY-MM
// @access  Private (Admin, Teacher)
const getBatchMonthlyRegister = async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const month = req.query.month || new Date().toISOString().substring(0, 7); // "YYYY-MM"

    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();

    // 0. Fetch the batch to know which weekdays it actually holds class
    const batch = await Batch.findById(batchId);
    if (!batch) {
      res.statusCode = 404;
      throw new Error('Batch not found');
    }
    const classDays = batch.classDays && batch.classDays.length > 0
      ? batch.classDays
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']; // fallback for older batches without this field set
    const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // 1. Fetch students enrolled in this batch, sorted by roll number
    const studentsInBatch = await StudentDetail.find({ batchId })
      .populate('userId', 'name phone')
      .sort({ rollNumber: 1 });

    // 2. Fetch every attendance record for this batch within the month
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-${String(daysInMonth).padStart(2, '0')}`;
    const records = await AttendanceRecord.find({
      batchId,
      date: { $gte: monthStart, $lte: monthEnd },
    });

    // Build a quick lookup: studentId -> { "YYYY-MM-DD": status }
    const recordLookup = {};
    records.forEach((r) => {
      const sid = r.studentId.toString();
      if (!recordLookup[sid]) recordLookup[sid] = {};
      recordLookup[sid][r.date] = r.status;
    });

    // 2b. Fetch every fee record for these students (sorted oldest-first so the
    // first entry per student is their one-time admission fee cycle)
    const studentUserIds = studentsInBatch.map((s) => s.userId._id);
    const allFees = await FeeRecord.find({ studentId: { $in: studentUserIds } }).sort({ billingMonth: 1 });

    const feesByStudent = {};
    allFees.forEach((f) => {
      const sid = f.studentId.toString();
      if (!feesByStudent[sid]) feesByStudent[sid] = [];
      feesByStudent[sid].push(f);
    });

    // 3. Build one row per student with a cell for every day of the month
    const rows = studentsInBatch.map((s) => {
      const sid = s.userId._id.toString();
      const days = [];
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${month}-${String(d).padStart(2, '0')}`;
        const weekdayAbbr = WEEKDAY_ABBR[new Date(`${dateStr}T00:00:00.000Z`).getUTCDay()];
        const isClassDay = classDays.includes(weekdayAbbr);
        const status = (recordLookup[sid] && recordLookup[sid][dateStr]) || null;
        days.push({ date: dateStr, status, isClassDay });
        if (status === 'present') presentCount += 1;
        else if (status === 'absent') absentCount += 1;
        else if (status === 'late') lateCount += 1;
      }

      const markedDays = presentCount + absentCount + lateCount;
      const percentage = markedDays > 0 ? Math.round(((presentCount + lateCount) / markedDays) * 100) : 0;

      const studentFees = feesByStudent[sid] || [];
      const admissionFeeRecord = studentFees[0]; // earliest billingMonth = the admission cycle
      const admissionFeeStatus = admissionFeeRecord ? admissionFeeRecord.status : 'pending';
      const pendingFeesCount = studentFees.filter((f) => f.status === 'pending' || f.status === 'partial').length;

      return {
        studentId: sid,
        name: s.userId.name,
        rollNumber: s.rollNumber,
        photoUrl: s.photoUrl,
        admissionFeeStatus,
        pendingFeesCount,
        days,
        presentCount,
        absentCount,
        lateCount,
        percentage,
      };
    });

    // 4. Batch-wide summary
    const totalPresent = rows.reduce((sum, r) => sum + r.presentCount, 0);
    const totalAbsent = rows.reduce((sum, r) => sum + r.absentCount, 0);
    const totalLate = rows.reduce((sum, r) => sum + r.lateCount, 0);
    const avgAttendance = rows.length > 0
      ? Math.round(rows.reduce((sum, r) => sum + r.percentage, 0) / rows.length)
      : 0;

    res.status(200).json({
      success: true,
      month,
      daysInMonth,
      classDays,
      totalStudents: rows.length,
      rows,
      summary: {
        totalPresent,
        totalAbsent,
        totalLate,
        avgAttendance,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateAttendanceCode,
  getActiveCode,
  checkIn,
  markManualAttendance,
  getStudentAttendanceHistory,
  getBatchAttendanceHistory,
  getBatchMonthlyRegister,
  finalizeAllExpiredCodes,
};