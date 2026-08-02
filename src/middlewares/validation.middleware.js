const { validationResult, body, param, query, header } = require('express-validator');

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
    .matches(/^\d{10}$/)
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
    .matches(/^\d{10}$/)
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
    if (rules.isEmail) {
      validators.push(
        body(field)
          .trim()
          .isEmail()
          .withMessage(rules.message || `${field} must be a valid email`)
          .normalizeEmail()
      );
    }
    if (rules.isPhone) {
      validators.push(
        body(field)
          .trim()
          .matches(/^\d{10}$/)
          .withMessage(rules.message || `${field} must be a valid 10-digit phone number`)
      );
    }
    if (rules.isObjectId) {
      validators.push(
        body(field)
          .matches(/^[0-9a-fA-F]{24}$/)
          .withMessage(rules.message || `${field} must be a valid ObjectId`)
      );
    }
    if (rules.isDate) {
      validators.push(
        body(field)
          .isISO8601()
          .withMessage(rules.message || `${field} must be a valid date`)
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

// ObjectId validation for params
const validateObjectId = (paramName = 'id') => [
  param(paramName)
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage(`Invalid ${paramName} format`),
  handleValidationErrors
];

// ObjectId validation for body fields
const validateBodyObjectId = (fieldName) => [
  body(fieldName)
    .trim()
    .notEmpty()
    .withMessage(`${fieldName} is required`)
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage(`Invalid ${fieldName} format`),
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

// Number validation with min/max
const validateNumber = (field, options = {}) => {
  const validators = [];
  const { required = false, min, max, message } = options;
  let chain = body(field);
  if (required) {
    chain = chain.notEmpty().withMessage(`${field} is required`);
  } else {
    chain = chain.optional();
  }
  chain = chain.isNumeric().withMessage(message || `${field} must be a number`);
  if (min !== undefined) {
    chain = chain.isFloat({ min }).withMessage(message || `${field} must be at least ${min}`);
  }
  if (max !== undefined) {
    chain = chain.isFloat({ max }).withMessage(message || `${field} must be at most ${max}`);
  }
  validators.push(chain);
  validators.push(handleValidationErrors);
  return validators;
};

// Date validation
const validateDate = (field, options = {}) => {
  const validators = [];
  const { required = false } = options;
  let chain = body(field);
  if (required) {
    chain = chain.notEmpty().withMessage(`${field} is required`);
  } else {
    chain = chain.optional();
  }
  chain = chain.isISO8601().withMessage(`${field} must be a valid ISO 8601 date`);
  validators.push(chain);
  validators.push(handleValidationErrors);
  return validators;
};

// Enum validation
const validateEnum = (field, allowedValues, options = {}) => {
  const validators = [];
  const { required = false, caseInsensitive = false } = options;
  let chain = body(field);
  if (required) {
    chain = chain.notEmpty().withMessage(`${field} is required`);
  } else {
    chain = chain.optional();
  }
  if (caseInsensitive) {
    chain = chain.trim().toLowerCase();
  }
  chain = chain.isIn(allowedValues.map(v => caseInsensitive ? v.toLowerCase() : v))
    .withMessage(`${field} must be one of: ${allowedValues.join(', ')}`);
  validators.push(chain);
  validators.push(handleValidationErrors);
  return validators;
};

// Boolean validation
const validateBoolean = (field, options = {}) => {
  const validators = [];
  const { required = false } = options;
  let chain = body(field);
  if (required) {
    chain = chain.notEmpty().withMessage(`${field} is required`);
  } else {
    chain = chain.optional();
  }
  chain = chain.isBoolean().withMessage(`${field} must be true or false`);
  validators.push(chain);
  validators.push(handleValidationErrors);
  return validators;
};

// String validation with length constraints
const validateString = (field, options = {}) => {
  const validators = [];
  const { required = false, minLength, maxLength, trim = true, isIn, message } = options;
  let chain = body(field);
  if (required) {
    chain = chain.notEmpty().withMessage(`${field} is required`);
  } else {
    chain = chain.optional();
  }
  if (trim) {
    chain = chain.trim();
  }
  if (minLength !== undefined) {
    chain = chain.isLength({ min: minLength }).withMessage(message || `${field} must be at least ${minLength} characters`);
  }
  if (maxLength !== undefined) {
    chain = chain.isLength({ max: maxLength }).withMessage(message || `${field} must be at most ${maxLength} characters`);
  }
  if (isIn) {
    chain = chain.isIn(isIn).withMessage(message || `${field} must be one of: ${isIn.join(', ')}`);
  }
  validators.push(chain);
  validators.push(handleValidationErrors);
  return validators;
};

// Validate that request body contains only allowed fields
const validateAllowedFields = (allowedFields) => {
  return (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
      return next();
    }
    const unknownFields = Object.keys(req.body).filter(field => !allowedFields.includes(field));
    if (unknownFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: unknownFields.map(field => ({
          field,
          message: `Unknown field: ${field}`
        }))
      });
    }
    next();
  };
};

// Validate refresh token
const validateRefreshToken = () => [
  body('refreshToken')
    .trim()
    .notEmpty()
    .withMessage('Refresh token is required'),
  handleValidationErrors
];

// Validate password
const validatePassword = (field = 'password', options = {}) => {
  const validators = [];
  const { required = true, minLength = 6, maxLength = 128 } = options;
  let chain = body(field);
  if (required) {
    chain = chain.notEmpty().withMessage(`${field} is required`);
  } else {
    chain = chain.optional();
  }
  chain = chain
    .isLength({ min: minLength, max: maxLength })
    .withMessage(`${field} must be between ${minLength} and ${maxLength} characters`);
  validators.push(chain);
  validators.push(handleValidationErrors);
  return validators;
};

module.exports = {
  validatePhone,
  validateOTP,
  validateEmail,
  validateLogin,
  validateUserId,
  validatePagination,
  validateBody,
  validateObjectId,
  validateBodyObjectId,
  validateName,
  validateMomentContent,
  validateNumber,
  validateDate,
  validateEnum,
  validateBoolean,
  validateString,
  validateAllowedFields,
  validateRefreshToken,
  validatePassword,
  handleValidationErrors
};