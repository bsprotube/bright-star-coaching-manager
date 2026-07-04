const FeeRecord = require('../models/FeeRecord');
const StudentDetail = require('../models/StudentDetail');
const User = require('../models/User');

const GRACE_PERIOD_DAYS = 0; // Fee becomes "pending" immediately on the cycle's start date

/**
 * Generate a fee record for a specific student for one billing cycle.
 * Cycles are anchored to the student's admission date (not the calendar month):
 * cycle 0 = admission date itself (the one-time joining/admission fee),
 * cycle 1, 2, 3... = admission date + N months (the recurring monthly fee).
 *
 * @param {string} studentUserId - Mongoose User ID of the student
 * @param {Date} cycleStartDate - The exact start date of this billing cycle
 * @param {number} cycleIndex - 0 for the admission cycle, 1+ for monthly cycles
 * @returns {Promise<Object|null>} Created or existing FeeRecord, or null if student inactive/missing
 */
const generateMonthlyFeeForStudent = async (studentUserId, cycleStartDate, cycleIndex = 0) => {
  // 1. Get Student Details
  const studentDetail = await StudentDetail.findOne({ userId: studentUserId });
  if (!studentDetail) return null;

  // Verify student is active
  const user = await User.findById(studentUserId);
  if (!user || !user.isActive) return null;

  // 2. Use the cycle's own month as the billing label (keeps existing per-student uniqueness working)
  const billingMonth = cycleStartDate.toISOString().substring(0, 7); // "YYYY-MM"

  // 3. Check if a fee record already exists for this cycle
  let feeRecord = await FeeRecord.findOne({
    studentId: studentUserId,
    billingMonth,
  });

  if (feeRecord) {
    return feeRecord; // Already created
  }

  // 4. Due date = cycle start + grace period (this is what makes the fee show as "pending")
  const dueDate = new Date(cycleStartDate);
  dueDate.setDate(dueDate.getDate() + GRACE_PERIOD_DAYS);

  // 5. Cycle 0 = one-time admission fee; every later cycle = recurring monthly fee
  const amountDue = cycleIndex === 0 ? studentDetail.admissionFee : studentDetail.monthlyFee;

  // 6. Create new pending fee record
  feeRecord = await FeeRecord.create({
    studentId: studentUserId,
    billingMonth,
    dueDate,
    amountDue,
    amountPaid: 0,
    status: 'pending',
    payments: [],
  });

  return feeRecord;
};

/**
 * Backfill every billing cycle for a single student, from their admission date up to today.
 * Cycle 0 is the joining fee (charged on admission date itself); cycle N starts exactly
 * N months after admission. Safe to call repeatedly — already-existing cycles are skipped.
 *
 * @param {string} studentUserId
 * @returns {Promise<Array>} Newly created fee records (existing ones are not included)
 */
const generateDuesUpToDateForStudent = async (studentUserId) => {
  const studentDetail = await StudentDetail.findOne({ userId: studentUserId });
  if (!studentDetail) return [];

  const user = await User.findById(studentUserId);
  if (!user || !user.isActive) return [];

  const admissionDate = new Date(studentDetail.admissionDate);
  const today = new Date();

  const newlyCreated = [];
  let cycleIndex = 0;
  let cycleStart = new Date(admissionDate);

  // Safety cap (240 cycles = 20 years) so a bad date can never cause an infinite loop
  while (cycleStart <= today && cycleIndex < 240) {
    const existingBefore = await FeeRecord.findOne({
      studentId: studentUserId,
      billingMonth: cycleStart.toISOString().substring(0, 7),
    });

    const record = await generateMonthlyFeeForStudent(studentUserId, cycleStart, cycleIndex);
    if (record && !existingBefore) {
      newlyCreated.push(record);
    }

    cycleIndex += 1;
    cycleStart = new Date(admissionDate);
    cycleStart.setMonth(cycleStart.getMonth() + cycleIndex);
  }

  return newlyCreated;
};

/**
 * Backfill billing cycles for every active student, up to today.
 * Safe and cheap to call on every Fee Management screen load — this is what makes
 * monthly fee generation feel fully automatic without any manual "Trigger Billing" step.
 *
 * @returns {Promise<Object>} Summary of execution
 */
const generateDuesForAllActiveStudents = async () => {
  const activeStudents = await User.find({ role: 'student', isActive: true });

  let invoicesCreated = 0;
  let studentsProcessed = 0;

  for (const student of activeStudents) {
    try {
      const created = await generateDuesUpToDateForStudent(student._id);
      invoicesCreated += created.length;
      studentsProcessed += 1;
    } catch (err) {
      console.error(`Failed to generate billing for student ${student._id}: ${err.message}`);
    }
  }

  return {
    totalActiveStudents: activeStudents.length,
    studentsProcessed,
    invoicesCreated,
  };
};

module.exports = {
  generateMonthlyFeeForStudent,
  generateDuesUpToDateForStudent,
  generateDuesForAllActiveStudents,
};
