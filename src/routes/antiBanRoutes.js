// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/routes/antiBanRoutes.js
// ARVIND PARTY - ANTI-BAN & DEVICE MANAGEMENT ROUTES (Owner Panel)
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const antiBanController = require('../controllers/antiBanController');
const { authMiddleware, requireRole } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.get('/banned-devices', validatePagination(), authMiddleware, antiBanController.listBannedDevices);

router.post('/ban-device', authMiddleware, requireRole('admin', 'owner'), antiBanController.banDevice);

router.post('/unban-device', authMiddleware, requireRole('admin', 'owner'), antiBanController.unbanDevice);

module.exports = router;