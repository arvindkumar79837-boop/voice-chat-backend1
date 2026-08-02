const express = require('express');
const router = express.Router();
const loginStreakController = require('../controllers/loginStreakController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────
router.get('/my-streak', validatePagination(), authMiddleware, loginStreakController.getLoginStreak);
router.post('/claim-daily', authMiddleware, validateAllowedFields([]), loginStreakController.claimDailyLogin);

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────
router.get('/admin/all', validatePagination(), authMiddleware, adminAuth, loginStreakController.adminGetAllStreaks);
router.put('/admin/reset/:userId', validateObjectId('userId'), authMiddleware, adminAuth, loginStreakController.adminResetStreak);

module.exports = router;