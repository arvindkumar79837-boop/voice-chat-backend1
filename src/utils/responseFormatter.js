const successResponse = (res, data, message, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message: message || 'Success',
    data
  });
};

const errorResponse = (res, message, statusCode = 400) => {
  res.status(statusCode).json({
    success: false,
    message: message || 'Error'
  });
};

module.exports = { successResponse, errorResponse };
