// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/middlewares/massAssignment.middleware.js
// ARVIND PARTY - MASS ASSIGNMENT PREVENTION MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

const AppError = require('../utils/AppError');
const Logger = require('../utils/logger');

/**
 * Middleware factory that validates request body contains only allowed fields.
 * Prevents mass assignment vulnerabilities by whitelisting updatable fields.
 * 
 * @param {Array} allowedFields - Array of field names that are allowed to be updated
 * @param {Object} options - Additional options
 * @param {boolean} options.strict - If true, rejects requests with no updatable fields
 * @returns {Function} Express middleware
 */
const preventMassAssignment = (allowedFields, options = {}) => {
  const { strict = false } = options;

  return (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
      if (strict) {
        return res.status(400).json({
          success: false,
          message: 'Request body is required',
          code: 'MISSING_BODY'
        });
      }
      return next();
    }

    // Check for dangerous fields that should never be mass-assigned
    const dangerousFields = [
      'password',
      'passwordHash',
      'salt',
      'role',
      'isAdmin',
      'isOwner',
      'permissions',
      'coins',
      'diamonds',
      'balance',
      'wallet',
      'twoFactorEnabled',
      'twoFactorSecret',
      'refreshTokens',
      'accessTokens',
      'apiKeys',
      'secret',
      'token',
      'isBanned',
      'bannedAt',
      'banReason',
      'isDeleted',
      'deletedAt',
      'createdAt',
      'updatedAt',
      '_id',
      '__v'
    ];

    const requestedFields = Object.keys(req.body);
    const unauthorizedFields = requestedFields.filter(field => 
      dangerousFields.includes(field) && !allowedFields.includes(field)
    );

    if (unauthorizedFields.length > 0) {
      Logger.warn('[Mass Assignment] Blocked attempt to update protected fields:', {
        fields: unauthorizedFields,
        userId: req.user?.id || req.user?.userId,
        ip: req.ip,
        path: req.path
      });

      return res.status(403).json({
        success: false,
        message: 'Cannot update protected fields',
        code: 'MASS_ASSIGNMENT_BLOCKED',
        fields: unauthorizedFields
      });
    }

    // Filter body to only include allowed fields
    const filteredBody = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        filteredBody[field] = req.body[field];
      }
    }

    // Replace req.body with filtered version
    req.body = filteredBody;

    if (Object.keys(filteredBody).length === 0 && strict) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
        code: 'NO_UPDATABLE_FIELDS'
      });
    }

    next();
  };
};

/**
 * Creates a whitelist of allowed fields for specific entity updates
 */
const allowedFields = {
  // User profile fields (user can update)
  userProfile: [
    'name',
    'displayName',
    'avatar',
    'bio',
    'gender',
    'dob',
    'username',
    'phone',
    'email',
    'coverPhoto',
    'location',
    'website',
    'socialLinks'
  ],
  
  // Admin can update these user fields
  adminUserUpdate: [
    'name',
    'displayName',
    'avatar',
    'bio',
    'role',
    'isActive',
    'isBanned',
    'banReason',
    'coins',
    'diamonds',
    'level',
    'xp',
    'vipLevel',
    'vipExpiry'
  ],
  
  // Room fields
  room: [
    'name',
    'description',
    'category',
    'isPrivate',
    'maxParticipants',
    'settings',
    'tags',
    'coverImage'
  ],
  
  // Gift fields
  gift: [
    'name',
    'description',
    'price',
    'image',
    'isActive',
    'category',
    'diamondValue'
  ],
  
  // Agency fields
  agency: [
    'name',
    'description',
    'logo',
    'banner',
    'settings',
    'commissionRate',
    'isApproved',
    'status'
  ],
  
  // Event fields
  event: [
    'title',
    'description',
    'startDate',
    'endDate',
    'prizes',
    'rules',
    'image',
    'isActive',
    'maxParticipants'
  ]
};

/**
 * Get allowed fields for a specific entity type
 * @param {string} entityType - Type of entity (userProfile, adminUserUpdate, etc.)
 * @returns {Array} Array of allowed field names
 */
const getAllowedFields = (entityType) => {
  return allowedFields[entityType] || [];
};

/**
 * Middleware specifically for preventing role escalation
 * Ensures users cannot elevate their own privileges
 */
const preventRoleEscalation = (req, res, next) => {
  const roleFields = ['role', 'isAdmin', 'isOwner', 'permissions', 'privileges'];
  
  const attemptedRoleChange = roleFields.some(field => 
    req.body[field] !== undefined
  );

  if (attemptedRoleChange) {
    Logger.warn('[Mass Assignment] Role escalation attempt:', {
      userId: req.user?.id || req.user?.userId,
      userRole: req.user?.role,
      attemptedFields: roleFields.filter(f => req.body[f] !== undefined),
      ip: req.ip,
      path: req.path
    });

    return res.status(403).json({
      success: false,
      message: 'Cannot modify role or permissions',
      code: 'ROLE_ESCALATION_BLOCKED'
    });
  }

  next();
};

/**
 * Middleware to prevent currency manipulation
 * Blocks direct updates to balance fields unless explicitly allowed
 */
const preventCurrencyManipulation = (req, res, next) => {
  const currencyFields = ['coins', 'diamonds', 'balance', 'wallet', 'credits', 'points'];
  
  const attemptedUpdate = currencyFields.filter(field => 
    req.body[field] !== undefined
  );

  if (attemptedUpdate.length > 0) {
    // Only allow if the route is specifically designed for currency operations
    // and has additional authorization
    const allowedPaths = [
      '/api/admin/wallet',
      '/api/rewards',
      '/api/coin-orders'
    ];

    const isAllowedPath = allowedPaths.some(path => 
      req.path.includes(path)
    );

    if (!isAllowedPath) {
      Logger.warn('[Mass Assignment] Currency manipulation attempt:', {
        userId: req.user?.id || req.user?.userId,
        attemptedFields: attemptedUpdate,
        ip: req.ip,
        path: req.path
      });

      return res.status(403).json({
        success: false,
        message: 'Cannot directly modify currency fields',
        code: 'CURRENCY_MANIPULATION_BLOCKED',
        fields: attemptedUpdate
      });
    }
  }

  next();
};

module.exports = {
  preventMassAssignment,
  allowedFields,
  getAllowedFields,
  preventRoleEscalation,
  preventCurrencyManipulation
};