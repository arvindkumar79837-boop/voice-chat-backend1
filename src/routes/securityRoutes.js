// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/routes/securityRoutes.js
// ARVIND PARTY — Security, 2FA, Device Management Routes
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/auth.middleware');
const securityController = require('../controllers/authSecure.controller');
const adminSecurityController = require('../controllers/security.controller');

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

router.post('/2fa/enable', authLimiter, authMiddleware, securityController.enable2FA);
router.post('/2fa/verify-enable', authLimiter, authMiddleware, securityController.verifyAndEnable2FA);
router.post('/2fa/disable', authLimiter, authMiddleware, securityController.disable2FA);
router.get('/2fa/status', authMiddleware, securityController.get2FAStatus);

// ═══════════════════════════════════════════════════════════════════════════
// DEVICE & SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

router.get('/devices/sessions', authMiddleware, securityController.getActiveSessions);
router.post('/devices/sessions/:sessionId/logout', authMiddleware, securityController.logoutDevice);
router.post('/devices/sessions/:sessionId/trust', authMiddleware, securityController.trustDevice);

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN HISTORY
// ═══════════════════════════════════════════════════════════════════════════

router.get('/login-history', authMiddleware, securityController.getLoginHistory);

// ═══════════════════════════════════════════════════════════════════════════
// PASSWORD MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

router.post('/forgot-password', authLimiter, securityController.forgotPassword);
router.post('/reset-password', authLimiter, securityController.resetPassword);
router.post('/change-password', authLimiter, authMiddleware, securityController.changePassword);

// ═══════════════════════════════════════════════════════════════════════════
// SUSPICIOUS ACTIVITY & ALERTS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/suspicious-alerts', authMiddleware, securityController.getSuspiciousAlerts);

// ═══════════════════════════════════════════════════════════════════════════
// ACCOUNT RECOVERY
// ═══════════════════════════════════════════════════════════════════════════

router.post('/recovery/setup', authMiddleware, securityController.setupRecovery);

// ═══════════════════════════════════════════════════════════════════════════
// TERMS & PRIVACY
// ═══════════════════════════════════════════════════════════════════════════

router.post('/terms/accept', authMiddleware, securityController.acceptTerms);

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
router.get('/dashboard', ...secureRole, adminSecurityController.getDashboard);

// ─── FRAUD ALERTS ─────────────────────────────────────────────────────────────
router.get('/fraud-alerts', ...secureRole, adminSecurityController.getFraudAlerts);
router.put('/fraud-alerts/:id', ...secureRole, adminSecurityController.updateFraudAlert);

// ─── BANNED DEVICES ───────────────────────────────────────────────────────────
router.get('/banned-devices', ...secureRole, adminSecurityController.getBannedDevices);
router.post('/banned-devices', ...secureRole, adminSecurityController.banDevice);
router.delete('/banned-devices/:id', ...secureRole, adminSecurityController.unbanDevice);

// ─── BLOCKED IP ADDRESSES ─────────────────────────────────────────────────────
router.get('/blocked-ips', ...secureRole, adminSecurityController.getBlockedIps);
router.post('/blocked-ips', ...secureRole, adminSecurityController.blockIp);
router.delete('/blocked-ips/:id', ...secureRole, adminSecurityController.unblockIp);

// ─── AUDIT LOGS (immutable append-only) ───────────────────────────────────────
router.get('/audit-logs', ...secureRole, adminSecurityController.getAuditLogs);

// ─── LIVE THREATS ─────────────────────────────────────────────────────────────
router.get('/live-threats', ...secureRole, adminSecurityController.getLiveThreats);

module.exports = router;
