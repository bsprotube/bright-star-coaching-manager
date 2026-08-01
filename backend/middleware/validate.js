/**
 * Request validation middleware built on Joi.
 *
 * Controllers already check required fields, and Mongoose enforces types and enums
 * at the database layer — but both of those run late. Validating at the edge means
 * a malformed or hostile payload is rejected before it reaches any query or write,
 * and it gives the client one consistent error shape instead of a mix of hand-rolled
 * messages and Mongoose CastErrors.
 *
 * Values are coerced (Joi converts "25" to 25), which matters for multipart routes
 * where multer delivers every field as a string, and unknown keys are stripped so a
 * client can't smuggle extra fields into a create/update.
 */
const Joi = require('joi');

const OPTIONS = {
  abortEarly: false, // report every problem at once, not just the first
  stripUnknown: true,
  convert: true,
};

/**
 * @param {{ body?: Joi.Schema, params?: Joi.Schema, query?: Joi.Schema }} schemas
 */
const validate = (schemas) => (req, res, next) => {
  const details = [];

  for (const key of ['params', 'query', 'body']) {
    const schema = schemas[key];
    if (!schema) continue;

    const { error, value } = schema.validate(req[key], OPTIONS);
    if (error) {
      details.push(...error.details.map((d) => d.message));
      continue;
    }

    // req.query is a getter-only property on Express 5; assigning per-key keeps
    // this working across versions without replacing the object wholesale.
    if (key === 'query') {
      for (const k of Object.keys(req.query)) delete req.query[k];
      Object.assign(req.query, value);
    } else {
      req[key] = value;
    }
  }

  if (details.length) {
    res.statusCode = 400;
    return next(new Error(details.join('; ')));
  }

  return next();
};

// Reusable pieces
const objectId = Joi.string().hex().length(24).messages({
  'string.hex': '{{#label}} must be a valid ID',
  'string.length': '{{#label}} must be a valid ID',
});

const phone = Joi.string().trim().pattern(/^[0-9+\-\s()]{8,20}$/).messages({
  'string.pattern.base': '{{#label}} must be a valid phone number',
});

const password = Joi.string().min(6).max(128);
const monthString = Joi.string().pattern(/^\d{4}-\d{2}$/).messages({
  'string.pattern.base': '{{#label}} must be in YYYY-MM format',
});
const dateString = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).messages({
  'string.pattern.base': '{{#label}} must be in YYYY-MM-DD format',
});

module.exports = { validate, Joi, objectId, phone, password, monthString, dateString };
