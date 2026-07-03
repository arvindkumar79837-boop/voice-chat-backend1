const express = require('express');
const router = express.Router();
const loginStreakController = require('../controllers/loginStreakController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────
router.get('/my-streak', authMiddleware, loginStreakController.getLoginStreak);
router.post('/claim-daily', authMiddleware, loginStreakController.claimDailyLogin);

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────
router.get('/admin/all', authMiddleware, adminAuth, loginStreakController.adminGetAllStreaks);
router.put('/admin/reset/:userId', authMiddleware, adminAuth, loginStreakController.adminResetStreak);

module.exports = router;