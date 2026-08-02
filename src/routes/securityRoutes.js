// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/routes/securityRoutes.js
// ARVIND PARTY — Security, 2FA, Device Management Routes
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/auth.middleware');
const securityController = require('../controllers/authSecure.controller');
const adminSecurityController = require('../controllers/security.controller');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 100 : 10,
  message: { success: false, message: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// All security routes require authentication + owner/admin role.
const secureRole = [authMiddleware, requireRole('owner', 'admin', 'superAdminUid', 'ownerWeb')];

// ═══════════════════════════════════════════════════════════════════════════
// TWO-FACTOR AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════

router.post('/2fa/enable', validateEnum('method', ['totp', 'sms', 'email'], { required: true }), authLimiter, authMiddleware, securityController.enable2FA);
router.post('/2fa/verify-enable', validateString('code', { required: true, minLength: 4, maxLength: 10 }), authLimiter, authMiddleware, securityController.verifyAndEnable2FA);
router.post('/2fa/disable', validateString('code', { required: true, minLength: 4, maxLength: 10 }), authLimiter, authMiddleware, securityController.disable2FA);
router.get('/2fa/status', validatePagination(), authMiddleware, securityController.get2FAStatus);

// ═══════════════════════════════════════════════════════════════════════════
// DEVICE & SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

router.get('/devices/sessions', validatePagination(), authMiddleware, securityController.getActiveSessions);
router.post('/devices/sessions/:sessionId/logout', validateObjectId('sessionId'), authMiddleware, securityController.logoutDevice);
router.post('/devices/sessions/:sessionId/trust', validateObjectId('sessionId'), authMiddleware, securityController.trustDevice);

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN HISTORY
// ═══════════════════════════════════════════════════════════════════════════

router.get('/login-history', validatePagination(), authMiddleware, securityController.getLoginHistory);

// ═══════════════════════════════════════════════════════════════════════════
// PASSWORD MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

router.post('/forgot-password', validateEmail(), authLimiter, securityController.forgotPassword);
router.post('/reset-password', validateString('token', { required: true }), validatePassword('newPassword', { required: true, minLength: 6, maxLength: 128 }), authLimiter, securityController.resetPassword);
router.post('/change-password', validatePassword('currentPassword', { required: true, minLength: 6, maxLength: 128 }), validatePassword('newPassword', { required: true, minLength: 6, maxLength: 128 }), authLimiter, authMiddleware, securityController.changePassword);

// ═══════════════════════════════════════════════════════════════════════════
// SUSPICIOUS ACTIVITY & ALERTS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/suspicious-alerts', validatePagination(), authMiddleware, securityController.getSuspiciousAlerts);

// ═══════════════════════════════════════════════════════════════════════════
// ACCOUNT RECOVERY
// ═══════════════════════════════════════════════════════════════════════════

router.post('/recovery/setup', validateEmail(), validatePhone(), authMiddleware, securityController.setupRecovery);

// ═══════════════════════════════════════════════════════════════════════════
// TERMS & PRIVACY
// ═══════════════════════════════════════════════════════════════════════════

router.post('/terms/accept', authMiddleware, securityController.acceptTerms);

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
router.get('/dashboard', validatePagination(), ...secureRole, adminSecurityController.getDashboard);

// ─── FRAUD ALERTS ─────────────────────────────────────────────────────────────
router.get('/fraud-alerts', validatePagination(), ...secureRole, adminSecurityController.getFraudAlerts);
router.put('/fraud-alerts/:id', validateObjectId('id'), ...secureRole, adminSecurityController.updateFraudAlert);

// ─── BANNED DEVICES ───────────────────────────────────────────────────────────
router.get('/banned-devices', validatePagination(), ...secureRole, adminSecurityController.getBannedDevices);
router.post('/banned-devices', validateString('deviceId', { required: true }), validateString('reason', { required: true, maxLength: 500 }), ...secureRole, adminSecurityController.banDevice);
router.delete('/banned-devices/:id', ...secureRole, adminSecurityController.unbanDevice);

// ─── BLOCKED IP ADDRESSES ─────────────────────────────────────────────────────
router.get('/blocked-ips', validatePagination(), ...secureRole, adminSecurityController.getBlockedIps);
router.post('/blocked-ips', ...secureRole, adminSecurityController.blockIp);
router.delete('/blocked-ips/:id', ...secureRole, adminSecurityController.unblockIp);

// ─── AUDIT LOGS (immutable append-only) ───────────────────────────────────────
router.get('/audit-logs', validatePagination(), ...secureRole, adminSecurityController.getAuditLogs);

// ─── LIVE THREATS ─────────────────────────────────────────────────────────────
router.get('/live-threats', validatePagination(), ...secureRole, adminSecurityController.getLiveThreats);

module.exports = router;
