const express = require('express');
const router = express.Router();
const loginStreakController = require('../controllers/loginStreakController');
const auth = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────
router.get('/my-streak', auth, loginStreakController.getLoginStreak);
router.post('/claim-daily', auth, loginStreakController.claimDailyLogin);

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────
router.get('/admin/all', auth, adminAuth, loginStreakController.adminGetAllStreaks);
router.put('/admin/reset/:userId', auth, adminAuth, loginStreakController.adminResetStreak);

module.exports = router;