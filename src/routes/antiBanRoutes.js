// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/routes/antiBanRoutes.js
// ARVIND PARTY - ANTI-BAN & DEVICE MANAGEMENT ROUTES (Owner Panel)
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const antiBanController = require('../controllers/antiBanController');
const { authMiddleware, requireRole } = require('../middlewares/auth.middleware');

router.get('/banned-devices', authMiddleware, antiBanController.listBannedDevices);

router.post('/ban-device', authMiddleware, requireRole('admin', 'owner'), antiBanController.banDevice);

router.post('/unban-device', authMiddleware, requireRole('admin', 'owner'), antiBanController.unbanDevice);

module.exports = router;