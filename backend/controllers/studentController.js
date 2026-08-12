const mongoose = require('mongoose');
const User = require('../models/User');
const StudentDetail = require('../models/StudentDetail');
const Batch = require('../models/Batch');
const AttendanceRecord = require('../models/AttendanceRecord');
const FeeRecord = require('../models/FeeRecord');
const { generateDuesUpToDateForStudent } = require('../services/billingService');

// @desc    Get all students with filters
// @route   GET /api/students
// @access  Private (Admin, Teacher)
const getStudents = async (req, res, next) => {
  try {
    const { batchId, search } = req.query;
    
    // 1. Build Query on User (Students only)
    const userQuery = { role: 'student', isActive: true };
    if (search) {
      userQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const students = await User.find(userQuery).select('-password');
    const studentUserIds = students.map(s => s._id);

    // 2. Fetch StudentDetails matching batch and user IDs
    const detailQuery = { userId: { $in: studentUserIds } };
    if (batchId) {
      detailQuery.batchId = batchId;
    }

    const details = await StudentDetail.find(detailQuery).populate('batchId', 'name');
    
    // Map details for quick access
    const detailMap = details.reduce((map, detail) => {
      map[detail.userId.toString()] = detail;
      return map;
    }, {});

    // 3. Assemble response list
    const studentList = [];
    for (const student of students) {
      const detail = detailMap[student._id.toString()];
      if (detail) {
        studentList.push({
          id: student._id,
          name: student.name,
          phone: student.phone,
          email: student.email,
          rollNumber: detail.rollNumber,
          parentPhone: detail.parentPhone,
          address: detail.address,
          admissionDate: detail.admissionDate,
          monthlyFee: detail.monthlyFee,
          admissionFee: detail.admissionFee,
          batch: detail.batchId ? detail.batchId.name : 'N/A',
          batchId: detail.batchId ? detail.batchId._id : null,
          photoUrl: detail.photoUrl,
        });
      }
    }

    res.status(200).json({
      success: true,
      count: studentList.length,
      data: studentList,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single student details + logs
// @route   GET /api/students/:id
// @access  Private (Admin, Teacher, Student)
const getStudentById = async (req, res, next) => {
  try {
    const studentId = req.params.id;

    // Permissions check: Student can only view their own profile
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      res.statusCode = 403;
      throw new Error('Not authorized to access this student profile');
    }

    const user = await User.findById(studentId).select('-password');
    if (!user || user.role !== 'student') {
      res.statusCode = 404;
      throw new Error('Student not found');
    }

    const detail = await StudentDetail.findOne({ userId: studentId }).populate('batchId', 'name schedule');
    if (!detail) {
      res.statusCode = 404;
      throw new Error('Student details not found');
    }

    // Fetch Attendance Stats
    const totalPresent = await AttendanceRecord.countDocuments({ studentId, status: 'present' });
    const totalAbsent = await AttendanceRecord.countDocuments({ studentId, status: 'absent' });
    const totalLate = await AttendanceRecord.countDocuments({ studentId, status: 'late' });
    const totalDays = totalPresent + totalAbsent + totalLate;
    
    const attendancePercentage = totalDays > 0 ? Math.round(((totalPresent + totalLate) / totalDays) * 100) : 100;

    // Fetch day-by-day attendance for a calendar view.
    // Accepts an optional ?calendarMonth=YYYY-MM query param; defaults to the current month.
    const calendarMonth = req.query.calendarMonth || new Date().toISOString().substring(0, 7);
    const monthStart = new Date(`${calendarMonth}-01T00:00:00.000Z`);
    const monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

    const monthRecords = await AttendanceRecord.find({
      studentId,
      date: { $gte: monthStart, $lt: monthEnd },
    }).select('date status');

    const attendanceCalendar = monthRecords.map((r) => ({
      date: new Date(r.date).toISOString().substring(0, 10), // "YYYY-MM-DD"
      status: r.status,
    }));

    // Fetch Fee Ledger History
    const feeRecords = await FeeRecord.find({ studentId }).sort({ billingMonth: -1 });

    // Quick summary of pending/partial dues across all months
    const pendingMonths = feeRecords.filter((f) => f.status !== 'paid');
    const totalPendingAmount = pendingMonths.reduce(
      (sum, f) => sum + (f.amountDue - f.amountPaid),
      0
    );

    res.status(200).json({
      success: true,
      data: {
        profile: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          isActive: user.isActive,
          rollNumber: detail.rollNumber,
          parentPhone: detail.parentPhone,
          address: detail.address,
          admissionDate: detail.admissionDate,
          monthlyFee: detail.monthlyFee,
          admissionFee: detail.admissionFee,
          batchName: detail.batchId ? detail.batchId.name : 'N/A',
          batchId: detail.batchId ? detail.batchId._id : null,
          batchSchedule: detail.batchId ? detail.batchId.schedule : '',
          photoUrl: detail.photoUrl,
        },
        stats: {
          attendancePercentage,
          totalPresent,
          totalAbsent,
          totalLate,
          totalDays,
        },
        calendarMonth,
        attendanceCalendar,
        fees: feeRecords,
        feeSummary: {
          pendingMonthsCount: pendingMonths.length,
          totalPendingAmount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create student
// @route   POST /api/students
// @access  Private (Admin)
// NOTE: MongoDB transactions (sessions) require a replica set / mongos, which a
// standalone local MongoDB instance does not provide. So instead of a transaction,
// we run the writes sequentially and manually roll back the User record if a
// later step fails, keeping the database consistent without needing sessions.
const createStudent = async (req, res, next) => {
  let createdUserId = null;

  try {
    const {
      name,
      phone,
      email,
      password,
      rollNumber,
      parentPhone,
      address,
      admissionDate,
      monthlyFee,
      admissionFee,
      batchId,
    } = req.body;

    // 1. Basic Validations
    if (!name || !phone || !password || !rollNumber || !parentPhone || !address || !monthlyFee || !admissionFee || !batchId) {
      res.statusCode = 400;
      throw new Error('Please fill in all required fields');
    }

    // Removing a student only deactivates them (see deleteStudent) and their phone
    // stays on the account, so a plain "does this number exist" check would retire
    // that number forever — the admin could never enrol the same person again, which
    // is exactly what happens when someone leaves and later rejoins. A deactivated
    // student is therefore re-enrolled onto their original account rather than
    // rejected: same user, new batch and roll number, with their old attendance,
    // marks and fee history still attached instead of stranded on a hidden record.
    // Only a number that currently belongs to someone reachable — an active student,
    // or any teacher/admin — is a genuine clash.
    const existingUser = await User.findOne({ phone });
    if (existingUser && (existingUser.isActive || existingUser.role !== 'student')) {
      res.statusCode = 400;
      throw new Error('Phone number is already registered');
    }
    const reEnrolling = Boolean(existingUser);

    // A re-enrolling student already owns a StudentDetail row, so their own record
    // must not count as the roll number being taken.
    const rollQuery = reEnrolling
      ? { rollNumber, userId: { $ne: existingUser._id } }
      : { rollNumber };
    const rollExists = await StudentDetail.findOne(rollQuery);
    if (rollExists) {
      res.statusCode = 400;
      throw new Error('Roll number is already assigned');
    }

    // Verify batch exists
    const batch = await Batch.findById(batchId);
    if (!batch) {
      res.statusCode = 400;
      throw new Error('Assigned batch does not exist');
    }

    // Parse image if uploaded
    let photoUrl = '';
    if (req.file) {
      photoUrl = `/uploads/${req.file.filename}`;
    }

    // 2. Create the User, or revive the deactivated one this phone belongs to.
    // createdUserId is only set on the create path: it drives the rollback below,
    // and deleting a revived account would destroy a real student's history.
    let user;
    if (reEnrolling) {
      existingUser.name = name;
      existingUser.email = email && email.trim() ? email.trim() : undefined;
      existingUser.password = password; // pre('save') hook re-hashes it
      existingUser.isActive = true;
      await existingUser.save();
      user = existingUser;
    } else {
      // NOTE: email has a unique index in the User schema. If we stored an empty
      // string "" for every student who leaves email blank, MongoDB treats those
      // as duplicate values and the second such student fails with E11000.
      // Passing `undefined` instead makes Mongoose omit the field entirely, so it
      // never collides with anyone else's blank email.
      user = await User.create({
        name,
        phone,
        email: email && email.trim() ? email.trim() : undefined,
        password,
        role: 'student',
      });
      createdUserId = user._id;
    }

    // 3. Create the StudentDetail, or overwrite the one a re-enrolling student
    // still has. Their photo is only replaced when a new one was actually
    // uploaded, so re-enrolling without picking a file doesn't blank it out.
    const detailFields = {
      userId: user._id,
      rollNumber,
      parentPhone,
      address,
      admissionDate: admissionDate || Date.now(),
      monthlyFee,
      admissionFee,
      batchId,
    };
    if (photoUrl || !reEnrolling) {
      detailFields.photoUrl = photoUrl;
    }

    await StudentDetail.findOneAndUpdate({ userId: user._id }, detailFields, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    });

    // 4. Generate the joining fee (and backfill any cycles already elapsed,
    // in case the admission date entered is in the past)
    await generateDuesUpToDateForStudent(user._id);

    res.status(201).json({
      success: true,
      message: reEnrolling
        ? 'Student re-registered successfully. Their previous attendance, marks and fee history have been kept.'
        : 'Student registered successfully',
      data: {
        id: user._id,
        name,
        rollNumber,
        batch: batch.name,
      },
    });
  } catch (error) {
    // Manual rollback: if the User record was created but a later step failed,
    // remove it so we don't leave an orphaned/incomplete student account.
    if (createdUserId) {
      try {
        await User.findByIdAndDelete(createdUserId);
        await StudentDetail.findOneAndDelete({ userId: createdUserId });
      } catch (cleanupError) {
        console.error('Rollback cleanup failed after createStudent error:', cleanupError);
      }
    }
    next(error);
  }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private (Admin)
const updateStudent = async (req, res, next) => {
  try {
    const studentId = req.params.id;
    const {
      name,
      phone,
      email,
      rollNumber,
      parentPhone,
      address,
      monthlyFee,
      admissionFee,
      batchId,
    } = req.body;

    const user = await User.findById(studentId);
    if (!user || user.role !== 'student') {
      res.statusCode = 404;
      throw new Error('Student not found');
    }

    const detail = await StudentDetail.findOne({ userId: studentId });
    if (!detail) {
      res.statusCode = 404;
      throw new Error('Student details not found');
    }

    // Phone Uniqueness Check
    if (phone && phone !== user.phone) {
      const phoneExists = await User.findOne({ phone });
      if (phoneExists) {
        res.statusCode = 400;
        throw new Error('Phone number is already in use by another user');
      }
      user.phone = phone;
    }

    // Roll Number Uniqueness Check
    if (rollNumber && rollNumber !== detail.rollNumber) {
      const rollExists = await StudentDetail.findOne({ rollNumber });
      if (rollExists) {
        res.statusCode = 400;
        throw new Error('Roll number is already assigned');
      }
      detail.rollNumber = rollNumber;
    }

    // Check Batch
    if (batchId && batchId !== detail.batchId.toString()) {
      const batch = await Batch.findById(batchId);
      if (!batch) {
        res.statusCode = 400;
        throw new Error('Target batch does not exist');
      }
      detail.batchId = batchId;
    }

    if (name) user.name = name;
    if (email !== undefined) user.email = email && email.trim() ? email.trim() : undefined;
    await user.save();

    if (parentPhone) detail.parentPhone = parentPhone;
    if (address) detail.address = address;
    if (monthlyFee) detail.monthlyFee = monthlyFee;
    if (admissionFee) detail.admissionFee = admissionFee;
    
    // Photo handling
    if (req.file) {
      detail.photoUrl = `/uploads/${req.file.filename}`;
    }

    await detail.save();

    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Deactivate student (Soft Delete)
// @route   DELETE /api/students/:id
// @access  Private (Admin)
const deleteStudent = async (req, res, next) => {
  try {
    const studentId = req.params.id;
    const user = await User.findById(studentId);

    if (!user || user.role !== 'student') {
      res.statusCode = 404;
      throw new Error('Student not found');
    }

    // Perform soft deactivation
    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Student deactivated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Let a student replace their own profile photo. A narrow sibling of
//          updateStudent rather than a reuse of it: that endpoint also accepts
//          roll number, batch and fee amounts, which must stay admin-only — this
//          one touches nothing but photoUrl, so a student calling it can't
//          reassign themselves to a cheaper batch by the same door.
// @route   PUT /api/students/me/photo
// @access  Private (Student)
const updateOwnPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      res.statusCode = 400;
      throw new Error('Please choose a photo to upload');
    }

    const detail = await StudentDetail.findOne({ userId: req.user._id });
    if (!detail) {
      res.statusCode = 404;
      throw new Error('Student profile not found');
    }

    detail.photoUrl = `/uploads/${req.file.filename}`;
    await detail.save();

    res.status(200).json({
      success: true,
      message: 'Photo updated successfully',
      data: { photoUrl: detail.photoUrl },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  updateOwnPhoto,
  deleteStudent,
};
