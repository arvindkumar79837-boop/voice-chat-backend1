const ApiResponse = {
  success: (res, message, data, statusCode = 200) => {
    return res.status(statusCode).json({ success: true, message, data });
  },
  error: (res, message, statusCode, error) => {
    return res.status(statusCode).json({ success: false, message, error });
  }
};

module.exports = ApiResponse;
