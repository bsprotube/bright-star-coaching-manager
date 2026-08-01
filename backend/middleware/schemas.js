/**
 * Joi schemas for every route that accepts input.
 *
 * Field names mirror exactly what each controller destructures off the request —
 * anything not listed here is stripped before the controller runs, so a client
 * can't smuggle extra fields into a create or update.
 */
const { Joi, objectId, phone, password, monthString, dateString } = require('./validate');

// ---------- auth ----------
const authSchemas = {
  login: {
    body: Joi.object({
      phone: phone.required(),
      password: Joi.string().required(), // length rules belong at signup, not login
    }),
  },

  registerAdmin: {
    body: Joi.object({
      name: Joi.string().trim().min(2).max(100).required(),
      phone: phone.required(),
      email: Joi.string().trim().email().allow('', null),
      password: password.required(),
    }),
  },

  updateCredentials: {
    body: Joi.object({
      currentPassword: Joi.string().required(),
      newPhone: phone,
      newEmail: Joi.string().trim().email().allow('', null),
      newPassword: password,
      securityQuestion: Joi.string().trim().max(200).allow('', null),
      securityAnswer: Joi.string().trim().max(200).allow('', null),
      otp: Joi.string().trim().pattern(/^\d{6}$/).messages({
        'string.pattern.base': 'Verification code must be 6 digits',
      }),
    }),
  },

  phoneOnly: {
    body: Joi.object({ phone: phone.required() }),
  },

  forgotPasswordReset: {
    body: Joi.object({
      phone: phone.required(),
      newPassword: password.required(),
      securityAnswer: Joi.string().trim().max(200),
      otp: Joi.string().trim().pattern(/^\d{6}$/).messages({
        'string.pattern.base': 'Verification code must be 6 digits',
      }),
    })
      // The controller accepts either proof; require at least one here too so a
      // payload carrying neither is rejected before it touches the database.
      .or('securityAnswer', 'otp'),
  },
};

// ---------- students ----------
// Numbers arrive as strings on these routes (multer parses multipart), which Joi's
// conversion handles.
const studentSchemas = {
  list: {
    query: Joi.object({
      batchId: objectId,
      search: Joi.string().trim().max(100).allow(''),
    }),
  },

  byId: {
    params: Joi.object({ id: objectId.required() }),
    query: Joi.object({ calendarMonth: monthString }),
  },

  create: {
    body: Joi.object({
      name: Joi.string().trim().min(2).max(100).required(),
      phone: phone.required(),
      email: Joi.string().trim().email().allow('', null),
      password: password.required(),
      rollNumber: Joi.string().trim().min(1).max(40).required(),
      parentPhone: phone.required(),
      address: Joi.string().trim().min(1).max(300).required(),
      admissionDate: Joi.date(),
      monthlyFee: Joi.number().min(0).max(1000000).required(),
      admissionFee: Joi.number().min(0).max(1000000).required(),
      batchId: objectId.required(),
    }),
  },

  update: {
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      name: Joi.string().trim().min(2).max(100),
      phone,
      email: Joi.string().trim().email().allow('', null),
      rollNumber: Joi.string().trim().min(1).max(40),
      parentPhone: phone,
      address: Joi.string().trim().min(1).max(300),
      monthlyFee: Joi.number().min(0).max(1000000),
      admissionFee: Joi.number().min(0).max(1000000),
      batchId: objectId,
    }),
  },

  idParam: {
    params: Joi.object({ id: objectId.required() }),
  },
};

// ---------- batches ----------
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const batchSchemas = {
  create: {
    body: Joi.object({
      name: Joi.string().trim().min(2).max(100).required(),
      description: Joi.string().trim().max(500).allow('', null),
      schedule: Joi.string().trim().max(200).allow('', null),
      monthlyFeeDefault: Joi.number().min(0).max(1000000).required(),
      classDays: Joi.array().items(Joi.string().valid(...WEEKDAYS)).max(7),
    }),
  },

  update: {
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      name: Joi.string().trim().min(2).max(100),
      description: Joi.string().trim().max(500).allow('', null),
      schedule: Joi.string().trim().max(200).allow('', null),
      monthlyFeeDefault: Joi.number().min(0).max(1000000),
      classDays: Joi.array().items(Joi.string().valid(...WEEKDAYS)).max(7),
    }),
  },

  idParam: {
    params: Joi.object({ id: objectId.required() }),
  },
};

// ---------- attendance ----------
const attendanceSchemas = {
  generateCode: {
    body: Joi.object({
      batchId: objectId.required(),
      code: Joi.string().trim().max(10),
      expiryMinutes: Joi.number().integer().min(1).max(600),
    }),
  },

  checkIn: {
    body: Joi.object({
      batchId: objectId.required(),
      code: Joi.string().trim().max(10).required(),
    }),
  },

  markManual: {
    body: Joi.object({
      studentId: objectId.required(),
      batchId: objectId.required(),
      date: dateString.required(),
      status: Joi.string().valid('present', 'absent', 'late').required(),
    }),
  },

  batchIdParam: {
    params: Joi.object({ batchId: objectId.required() }),
    query: Joi.object({ month: monthString }),
  },

  studentIdParam: {
    params: Joi.object({ studentId: objectId.required() }),
  },
};

// ---------- fees ----------
const feeSchemas = {
  dues: {
    query: Joi.object({ month: monthString }),
  },

  studentIdParam: {
    params: Joi.object({ studentId: objectId.required() }),
  },

  payment: {
    body: Joi.object({
      feeRecordId: objectId.required(),
      amount: Joi.number().greater(0).max(10000000).required(),
      paymentMethod: Joi.string().valid('cash', 'upi', 'card', 'bank_transfer'),
      transactionId: Joi.string().trim().max(100).allow('', null),
    }),
  },

  triggerBilling: {
    body: Joi.object({ month: monthString }),
  },
};

// ---------- tests ----------
const testSchemas = {
  list: {
    query: Joi.object({ batchId: objectId }),
  },

  create: {
    body: Joi.object({
      batchId: objectId.required(),
      title: Joi.string().trim().min(1).max(150).required(),
      testDate: Joi.date(),
      subjects: Joi.array()
        .items(
          Joi.object({
            name: Joi.string().trim().min(1).max(60).required(),
            maxMarks: Joi.number().min(1).max(1000).required(),
          })
        )
        .min(1)
        .max(20)
        .required(),
    }),
  },

  idParam: {
    params: Joi.object({ id: objectId.required() }),
  },

  saveMarks: {
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      results: Joi.array()
        .items(
          Joi.object({
            studentId: objectId.required(),
            isAbsent: Joi.boolean(),
            remarks: Joi.string().trim().max(300).allow('', null),
            marks: Joi.array().items(
              Joi.object({
                subject: Joi.string().trim().min(1).max(60).required(),
                // Range against the test's own maxMarks is enforced in the
                // controller, which knows the test; this just bounds it sanely.
                marksObtained: Joi.number().min(0).max(1000).required(),
              })
            ),
          })
        )
        .required(),
    }),
  },

  batchIdParam: {
    params: Joi.object({ batchId: objectId.required() }),
  },

  studentIdParam: {
    params: Joi.object({ studentId: objectId.required() }),
  },
};

// ---------- reports ----------
const REPORT_FORMATS = ['json', 'pdf', 'excel'];

const reportSchemas = {
  dailyAttendance: {
    query: Joi.object({
      batchId: objectId.required(),
      date: dateString,
      format: Joi.string().valid(...REPORT_FORMATS),
    }),
  },

  monthlyAttendance: {
    query: Joi.object({
      batchId: objectId.required(),
      month: monthString,
      format: Joi.string().valid(...REPORT_FORMATS),
    }),
  },

  feeDue: {
    query: Joi.object({
      month: monthString,
      format: Joi.string().valid(...REPORT_FORMATS),
    }),
  },

  feeCollection: {
    query: Joi.object({
      startDate: dateString.required(),
      endDate: dateString.required(),
      format: Joi.string().valid(...REPORT_FORMATS),
    }),
  },

  studentsDirectory: {
    query: Joi.object({
      batchId: objectId,
      format: Joi.string().valid(...REPORT_FORMATS),
    }),
  },
};

module.exports = {
  authSchemas,
  studentSchemas,
  batchSchemas,
  attendanceSchemas,
  feeSchemas,
  testSchemas,
  reportSchemas,
};
