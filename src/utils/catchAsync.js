/**
 * Wraps an async route handler to catch errors and forward them to Express error handler.
 * @param {Function} fn - Async route handler
 * @returns {Function} Express middleware function
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = catchAsync;
