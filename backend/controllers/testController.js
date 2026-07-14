const Test = require('../models/Test');
const TestResult = require('../models/TestResult');
const Batch = require('../models/Batch');
const User = require('../models/User');
const StudentDetail = require('../models/StudentDetail');

/**
 * Load the active students of a batch, with their roll numbers/photos, sorted by roll.
 * Shared by the marks-entry roster and the performance report.
 */
const getBatchRoster = async (batchId) => {
  const details = await StudentDetail.find({ batchId }).populate({
    path: 'userId',
    select: 'name phone isActive',
  });

  return details
    .filter((d) => d.userId && d.userId.isActive)
    .map((d) => ({
      studentId: d.userId._id,
      name: d.userId.name,
      rollNumber: d.rollNumber,
      photoUrl: d.photoUrl,
    }))
    .sort((a, b) => String(a.rollNumber).localeCompare(String(b.rollNumber), undefined, { numeric: true }));
};

// @desc    Create a test for a batch
// @route   POST /api/tests
// @access  Private (Admin, Teacher)
const createTest = async (req, res, next) => {
  try {
    const { batchId, title, testDate, subjects } = req.body;

    if (!batchId || !title || !Array.isArray(subjects) || subjects.length === 0) {
      res.statusCode = 400;
      throw new Error('Please provide a batch, a title and at least one subject');
    }

    const batch = await Batch.findById(batchId);
    if (!batch) {
      res.statusCode = 400;
      throw new Error('Batch does not exist');
    }

    const cleanSubjects = subjects.map((s) => ({
      name: String(s.name || '').trim(),
      maxMarks: Number(s.maxMarks),
    }));

    if (cleanSubjects.some((s) => !s.name || !Number.isFinite(s.maxMarks) || s.maxMarks < 1)) {
      res.statusCode = 400;
      throw new Error('Every subject needs a name and max marks of at least 1');
    }

    const names = cleanSubjects.map((s) => s.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      res.statusCode = 400;
      throw new Error('Subject names must be unique within a test');
    }

    const totalMaxMarks = cleanSubjects.reduce((sum, s) => sum + s.maxMarks, 0);

    const test = await Test.create({
      batchId,
      title: title.trim(),
      testDate: testDate || Date.now(),
      subjects: cleanSubjects,
      totalMaxMarks,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'Test created successfully',
      data: test,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List tests (optionally filtered by batch), newest first
// @route   GET /api/tests?batchId=...
// @access  Private (Admin, Teacher)
const getTests = async (req, res, next) => {
  try {
    const { batchId } = req.query;

    const query = {};
    if (batchId) query.batchId = batchId;

    const tests = await Test.find(query)
      .populate('batchId', 'name')
      .sort({ testDate: -1 });

    // How many students have been graded so far, per test — lets the UI show
    // "12/20 marks entered" without a second round-trip.
    const testIds = tests.map((t) => t._id);
    const graded = await TestResult.aggregate([
      { $match: { testId: { $in: testIds } } },
      { $group: { _id: '$testId', count: { $sum: 1 } } },
    ]);
    const gradedMap = graded.reduce((map, g) => {
      map[g._id.toString()] = g.count;
      return map;
    }, {});

    const data = tests.map((t) => ({
      id: t._id,
      title: t.title,
      testDate: t.testDate,
      batchId: t.batchId ? t.batchId._id : null,
      batchName: t.batchId ? t.batchId.name : 'N/A',
      subjects: t.subjects,
      totalMaxMarks: t.totalMaxMarks,
      gradedCount: gradedMap[t._id.toString()] || 0,
    }));

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get one test with the full batch roster and each student's marks
//          (students with no marks yet come back with blank entries, so the
//          marks-entry screen can render the whole roster in one pass)
// @route   GET /api/tests/:id
// @access  Private (Admin, Teacher)
const getTestById = async (req, res, next) => {
  try {
    const test = await Test.findById(req.params.id).populate('batchId', 'name');
    if (!test) {
      res.statusCode = 404;
      throw new Error('Test not found');
    }

    const roster = await getBatchRoster(test.batchId._id);
    const results = await TestResult.find({ testId: test._id });

    const resultMap = results.reduce((map, r) => {
      map[r.studentId.toString()] = r;
      return map;
    }, {});

    const rows = roster.map((student) => {
      const result = resultMap[student.studentId.toString()];

      // Always return one entry per subject, in the test's subject order, so the
      // entry form lines up even for students who haven't been graded yet.
      const marks = test.subjects.map((sub) => {
        const existing = result && result.marks.find((m) => m.subject === sub.name);
        return {
          subject: sub.name,
          maxMarks: sub.maxMarks,
          marksObtained: existing ? existing.marksObtained : null,
        };
      });

      return {
        ...student,
        marks,
        totalObtained: result ? result.totalObtained : null,
        percentage: result ? result.percentage : null,
        isAbsent: result ? result.isAbsent : false,
        isGraded: Boolean(result),
      };
    });

    res.status(200).json({
      success: true,
      data: {
        id: test._id,
        title: test.title,
        testDate: test.testDate,
        batchId: test.batchId._id,
        batchName: test.batchId.name,
        subjects: test.subjects,
        totalMaxMarks: test.totalMaxMarks,
        rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Save marks for a test (bulk upsert — send the whole roster at once)
// @route   PUT /api/tests/:id/marks
// @access  Private (Admin, Teacher)
const saveTestMarks = async (req, res, next) => {
  try {
    const { results } = req.body; // [{ studentId, isAbsent, marks: [{ subject, marksObtained }] }]

    if (!Array.isArray(results)) {
      res.statusCode = 400;
      throw new Error('Please provide a results array');
    }

    const test = await Test.findById(req.params.id);
    if (!test) {
      res.statusCode = 404;
      throw new Error('Test not found');
    }

    const maxBySubject = test.subjects.reduce((map, s) => {
      map[s.name] = s.maxMarks;
      return map;
    }, {});

    let saved = 0;

    for (const row of results) {
      if (!row || !row.studentId) continue;

      const isAbsent = Boolean(row.isAbsent);

      // An absent student is stored with no marks at all, so they're skipped by the
      // averages rather than being dragged down by a zero.
      let marks = [];
      if (!isAbsent) {
        const incoming = Array.isArray(row.marks) ? row.marks : [];

        // Skip students left completely blank — they simply haven't been graded yet.
        const anyEntered = incoming.some(
          (m) => m.marksObtained !== null && m.marksObtained !== undefined && m.marksObtained !== ''
        );
        if (!anyEntered) continue;

        for (const m of incoming) {
          const maxMarks = maxBySubject[m.subject];
          if (maxMarks === undefined) {
            res.statusCode = 400;
            throw new Error(`"${m.subject}" is not a subject of this test`);
          }

          const value = Number(m.marksObtained);
          if (!Number.isFinite(value) || value < 0 || value > maxMarks) {
            res.statusCode = 400;
            throw new Error(`Marks for "${m.subject}" must be between 0 and ${maxMarks}`);
          }

          marks.push({ subject: m.subject, marksObtained: value, maxMarks });
        }
      }

      // findOneAndUpdate with an upsert wouldn't run the pre-validate hook that keeps
      // the totals in sync, so load-or-create and save() instead.
      let result = await TestResult.findOne({ testId: test._id, studentId: row.studentId });
      if (!result) {
        result = new TestResult({ testId: test._id, studentId: row.studentId });
      }

      result.marks = marks;
      result.isAbsent = isAbsent;
      result.remarks = row.remarks;
      await result.save();
      saved += 1;
    }

    res.status(200).json({
      success: true,
      message: `Marks saved for ${saved} student(s)`,
      data: { saved },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a test and every result attached to it
// @route   DELETE /api/tests/:id
// @access  Private (Admin)
const deleteTest = async (req, res, next) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) {
      res.statusCode = 404;
      throw new Error('Test not found');
    }

    await TestResult.deleteMany({ testId: test._id });
    await test.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Test and its results deleted',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Performance report for a batch — every student ranked by average %,
//          with a per-subject average so weak subjects stand out.
// @route   GET /api/tests/performance/:batchId
// @access  Private (Admin, Teacher)
const getBatchPerformance = async (req, res, next) => {
  try {
    const { batchId } = req.params;

    const batch = await Batch.findById(batchId);
    if (!batch) {
      res.statusCode = 404;
      throw new Error('Batch not found');
    }

    const roster = await getBatchRoster(batchId);
    const tests = await Test.find({ batchId }).select('_id title testDate');
    const testIds = tests.map((t) => t._id);

    // Absent results carry no marks, so they're excluded from every average.
    const results = await TestResult.find({
      testId: { $in: testIds },
      isAbsent: false,
      totalMaxMarks: { $gt: 0 },
    });

    const byStudent = results.reduce((map, r) => {
      const key = r.studentId.toString();
      if (!map[key]) map[key] = [];
      map[key].push(r);
      return map;
    }, {});

    const students = roster.map((student) => {
      const studentResults = byStudent[student.studentId.toString()] || [];

      const testsTaken = studentResults.length;
      const averagePercentage =
        testsTaken > 0
          ? Math.round(studentResults.reduce((sum, r) => sum + r.percentage, 0) / testsTaken)
          : null;

      // Roll every subject the student has been graded in into an average, so a weak
      // subject shows up even when their overall percentage looks fine.
      const subjectTotals = {};
      for (const result of studentResults) {
        for (const m of result.marks) {
          if (!subjectTotals[m.subject]) {
            subjectTotals[m.subject] = { obtained: 0, max: 0 };
          }
          subjectTotals[m.subject].obtained += m.marksObtained;
          subjectTotals[m.subject].max += m.maxMarks;
        }
      }

      const subjects = Object.entries(subjectTotals).map(([name, t]) => ({
        name,
        percentage: t.max > 0 ? Math.round((t.obtained / t.max) * 100) : 0,
      }));
      subjects.sort((a, b) => a.percentage - b.percentage); // weakest first

      return {
        ...student,
        testsTaken,
        averagePercentage,
        subjects,
        weakestSubject: subjects.length > 0 ? subjects[0] : null,
        bestSubject: subjects.length > 0 ? subjects[subjects.length - 1] : null,
      };
    });

    // Rank only the students who have actually sat a test; ungraded students are
    // listed after them with no rank rather than being ranked last on zero data.
    const graded = students
      .filter((s) => s.averagePercentage !== null)
      .sort((a, b) => b.averagePercentage - a.averagePercentage)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    const ungraded = students
      .filter((s) => s.averagePercentage === null)
      .map((s) => ({ ...s, rank: null }));

    const classAverage =
      graded.length > 0
        ? Math.round(graded.reduce((sum, s) => sum + s.averagePercentage, 0) / graded.length)
        : null;

    // Class-wide subject averages — tells the teacher which subject the whole batch
    // is struggling with, not just individual students.
    const classSubjectTotals = {};
    for (const result of results) {
      for (const m of result.marks) {
        if (!classSubjectTotals[m.subject]) {
          classSubjectTotals[m.subject] = { obtained: 0, max: 0 };
        }
        classSubjectTotals[m.subject].obtained += m.marksObtained;
        classSubjectTotals[m.subject].max += m.maxMarks;
      }
    }
    const classSubjects = Object.entries(classSubjectTotals)
      .map(([name, t]) => ({
        name,
        percentage: t.max > 0 ? Math.round((t.obtained / t.max) * 100) : 0,
      }))
      .sort((a, b) => a.percentage - b.percentage);

    res.status(200).json({
      success: true,
      data: {
        batchId,
        batchName: batch.name,
        totalTests: tests.length,
        classAverage,
        classSubjects,
        students: [...graded, ...ungraded],
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    One student's own test history + subject averages
// @route   GET /api/tests/student/:studentId
// @access  Private (Admin, Teacher, Student — students may only read their own)
const getStudentPerformance = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      res.statusCode = 403;
      throw new Error('Not authorized to view these results');
    }

    const student = await User.findById(studentId).select('name');
    if (!student) {
      res.statusCode = 404;
      throw new Error('Student not found');
    }

    const results = await TestResult.find({ studentId })
      .populate('testId', 'title testDate totalMaxMarks')
      .sort({ createdAt: -1 });

    const valid = results.filter((r) => r.testId && !r.isAbsent && r.totalMaxMarks > 0);

    const history = results
      .filter((r) => r.testId)
      .map((r) => ({
        testId: r.testId._id,
        title: r.testId.title,
        testDate: r.testId.testDate,
        isAbsent: r.isAbsent,
        marks: r.marks,
        totalObtained: r.totalObtained,
        totalMaxMarks: r.totalMaxMarks,
        percentage: r.percentage,
      }))
      .sort((a, b) => new Date(b.testDate) - new Date(a.testDate));

    const averagePercentage =
      valid.length > 0
        ? Math.round(valid.reduce((sum, r) => sum + r.percentage, 0) / valid.length)
        : null;

    const subjectTotals = {};
    for (const result of valid) {
      for (const m of result.marks) {
        if (!subjectTotals[m.subject]) {
          subjectTotals[m.subject] = { obtained: 0, max: 0 };
        }
        subjectTotals[m.subject].obtained += m.marksObtained;
        subjectTotals[m.subject].max += m.maxMarks;
      }
    }
    const subjects = Object.entries(subjectTotals)
      .map(([name, t]) => ({
        name,
        obtained: t.obtained,
        max: t.max,
        percentage: t.max > 0 ? Math.round((t.obtained / t.max) * 100) : 0,
      }))
      .sort((a, b) => a.percentage - b.percentage);

    res.status(200).json({
      success: true,
      data: {
        studentId,
        name: student.name,
        testsTaken: valid.length,
        averagePercentage,
        subjects,
        weakestSubject: subjects.length > 0 ? subjects[0] : null,
        bestSubject: subjects.length > 0 ? subjects[subjects.length - 1] : null,
        history,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTest,
  getTests,
  getTestById,
  saveTestMarks,
  deleteTest,
  getBatchPerformance,
  getStudentPerformance,
};
