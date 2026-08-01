const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Full detail goes to the server log, never to the client.
  console.error(err.stack || err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = new Error(message);
    res.statusCode = 404;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new Error(message);
    res.statusCode = 400;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new Error(message);
    res.statusCode = 400;
  }

  const status = res.statusCode === 200 ? 500 : res.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // 4xx messages are written for the user by the controllers, so they're safe to
  // return as-is. A 5xx means something unexpected broke, and that message comes
  // from a library or the driver — it can carry hostnames, file paths or query
  // fragments — so in production it's replaced with a generic one.
  const body = {
    success: false,
    message: isProduction && status >= 500
      ? 'Something went wrong. Please try again.'
      : error.message || 'Server Error',
  };

  if (!isProduction) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
};

module.exports = { errorHandler };
