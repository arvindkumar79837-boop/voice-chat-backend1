// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/utils/apiResponse.js
// ARVIND PARTY - STANDARD API RESPONSE UTILITY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Standard success response
 * @param {Object} res - Express response object
 * @param {Object} options - Response options
 * @param {number} options.status - HTTP status code (default: 200)
 * @param {string} options.message - Success message
 * @param {*} options.data - Response data
 * @param {Object} options.meta - Pagination metadata
 */
const success = (res, { status = 200, message = 'Success', data = null, meta = null } = {}) => {
  const response = { success: true, message };
  if (data !== null) response.data = data;
  if (meta) response.meta = meta;
  return res.status(status).json(response);
};

/**
 * Standard error response
 * @param {Object} res - Express response object
 * @param {Object} options - Response options
 * @param {number} options.status - HTTP status code (default: 400)
 * @param {string} options.message - Error message
 * @param {string} options.code - Machine-readable error code
 * @param {Array} options.errors - Field-specific errors
 */
const error = (res, { status = 400, message = 'Error', code = 'ERROR', errors = null } = {}) => {
  const response = { success: false, message, code };
  if (errors) response.errors = errors;
  return res.status(status).json(response);
};

/**
 * Standard created response (201)
 */
const created = (res, { message = 'Created successfully', data = null } = {}) => {
  return success(res, { status: 201, message, data });
};

/**
 * Standard no content response (204)
 */
const noContent = (res) => {
  return res.status(204).end();
};

/**
 * Standard not found response (404)
 */
const notFound = (res, { message = 'Resource not found', code = 'NOT_FOUND' } = {}) => {
  return error(res, { status: 404, message, code });
};

/**
 * Standard unauthorized response (401)
 */
const unauthorized = (res, { message = 'Authentication required', code = 'UNAUTHORIZED' } = {}) => {
  return error(res, { status: 401, message, code });
};

/**
 * Standard forbidden response (403)
 */
const forbidden = (res, { message = 'Access denied', code = 'FORBIDDEN' } = {}) => {
  return error(res, { status: 403, message, code });
};

/**
 * Standard conflict response (409)
 */
const conflict = (res, { message = 'Resource already exists', code = 'CONFLICT' } = {}) => {
  return error(res, { status: 409, message, code });
};

/**
 * Standard validation error response (422)
 */
const validationError = (res, { message = 'Validation failed', errors = [] } = {}) => {
  return error(res, { status: 422, message, code: 'VALIDATION_ERROR', errors });
};

/**
 * Standard internal server error response (500)
 */
const serverError = (res, { message = 'Internal server error', code = 'INTERNAL_ERROR' } = {}) => {
  return error(res, { status: 500, message, code });
};

/**
 * Build pagination metadata
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 */
const buildPaginationMeta = (page = 1, limit = 20, total = 0) => {
  const totalPages = Math.ceil(total / limit) || 0;
  return {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
};

/**
 * Parse pagination query parameters
 * @param {Object} query - Express query object
 */
const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Parse sorting query parameters
 * @param {Object} query - Express query object
 * @param {Array} allowedFields - Allowed sort fields
 */
const parseSorting = (query, allowedFields = ['createdAt']) => {
  const sortField = query.sort && allowedFields.includes(query.sort) ? query.sort : 'createdAt';
  const sortOrder = query.order === 'asc' ? 1 : -1;
  return { [sortField]: sortOrder };
};

/**
 * Parse filtering query parameters
 * @param {Object} query - Express query object
 * @param {Object} filterConfig - Filter configuration
 * @param {Array} filterConfig.allowed - Allowed filter fields
 * @param {Object} filterConfig.types - Field types (string, number, boolean, date)
 */
const parseFilters = (query, filterConfig = {}) => {
  const { allowed = [], types = {} } = filterConfig;
  const filters = {};

  for (const field of allowed) {
    if (query[field] !== undefined) {
      const type = types[field] || 'string';
      switch (type) {
        case 'number':
          filters[field] = parseFloat(query[field]);
          break;
        case 'boolean':
          filters[field] = query[field] === 'true';
          break;
        case 'date':
          filters[field] = new Date(query[field]);
          break;
        default:
          filters[field] = query[field];
      }
    }
  }

  // Range filters (min/max)
  for (const field of allowed) {
    if (query[`min${field.charAt(0).toUpperCase() + field.slice(1)}`] !== undefined) {
      const value = parseFloat(query[`min${field.charAt(0).toUpperCase() + field.slice(1)}`]);
      filters[field] = { ...(filters[field] || {}), $gte: value };
    }
    if (query[`max${field.charAt(0).toUpperCase() + field.slice(1)}`] !== undefined) {
      const value = parseFloat(query[`max${field.charAt(0).toUpperCase() + field.slice(1)}`]);
      filters[field] = { ...(filters[field] || {}), $lte: value };
    }
  }

  return filters;
};

module.exports = {
  success,
  error,
  created,
  noContent,
  notFound,
  unauthorized,
  forbidden,
  conflict,
  validationError,
  serverError,
  buildPaginationMeta,
  parsePagination,
  parseSorting,
  parseFilters
};