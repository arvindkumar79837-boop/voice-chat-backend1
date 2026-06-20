const { validationResult, body, param, query } = require('express-validator');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

// Phone number validation
const validatePhone = () => [
  body('phone')
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone must be 10 digits'),
  handleValidationErrors
];

// OTP validation
const validateOTP = () => [
  body('otp')
    .trim()
    .isLength({ min: 4, max: 6 })
    .withMessage('OTP must be 4-6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers'),
  handleValidationErrors
];

// Email validation
const validateEmail = () => [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail(),
  handleValidationErrors
];

// Login validation
const validateLogin = () => [
  body('phone')
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone must be 10 digits'),
  body('otp')
    .trim()
    .isLength({ min: 4, max: 6 })
    .withMessage('OTP must be 4-6 digits'),
  handleValidationErrors
];

// User ID validation
const validateUserId = () => [
  param('userId')
    .trim()
    .notEmpty()
    .withMessage('User ID is required'),
  handleValidationErrors
];

// Pagination validation
const validatePagination = () => [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

// Common body field validators
const validateBody = (fields) => {
  const validators = [];
  for (const [field, rules] of Object.entries(fields)) {
    if (rules.required) {
      validators.push(
        body(field)
          .notEmpty()
          .withMessage(`${field} is required`)
      );
    }
    if (rules.minLength) {
      validators.push(
        body(field)
          .isLength({ min: rules.minLength })
          .withMessage(rules.message || `${field} must be at least ${rules.minLength} characters`)
      );
    }
    if (rules.maxLength) {
      validators.push(
        body(field)
          .isLength({ max: rules.maxLength })
          .withMessage(rules.message || `${field} must be at most ${rules.maxLength} characters`)
      );
    }
    if (rules.isNumeric) {
      validators.push(
        body(field)
          .isNumeric()
          .withMessage(rules.message || `${field} must be a number`)
      );
    }
    if (rules.isBoolean) {
      validators.push(
        body(field)
          .isBoolean()
          .withMessage(rules.message || `${field} must be true or false`)
      );
    }
    if (rules.isIn) {
      validators.push(
        body(field)
          .isIn(rules.isIn)
          .withMessage(rules.message || `${field} must be one of: ${rules.isIn.join(', ')}`)
      );
    }
    if (rules.trim) {
      validators.push(
        body(field)
          .trim()
      );
    }
  }
  validators.push(handleValidationErrors);
  return validators;
};

// ObjectId validation
const validateObjectId = (paramName = 'id') => [
  param(paramName)
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage(`Invalid ${paramName} format`),
  handleValidationErrors
];

// Name validation (for profile updates, etc.)
const validateName = () => [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  handleValidationErrors
];

// Moment/Post content validation
const validateMomentContent = () => [
  body('content')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Content must be at most 500 characters'),
  handleValidationErrors
];

module.exports = {
  validatePhone,
  validateOTP,
  validateEmail,
  validateLogin,
  validateUserId,
  validatePagination,
  validateBody,
  validateObjectId,
  validateName,
  validateMomentContent,
  handleValidationErrors
};
