/**
 * @desc Higher-order function to catch async errors and pass them to the express error handler
 */
const catchAsync = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = catchAsync;
