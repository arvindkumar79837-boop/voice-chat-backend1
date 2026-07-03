const express = require('express');
const router = express.Router();
const inviteEventController = require('../controllers/inviteEventController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────
router.post('/generate', authMiddleware, inviteEventController.generateInviteLink);
router.post('/register', authMiddleware, inviteEventController.registerViaInvite);
router.post('/commission', authMiddleware, inviteEventController.processRechargeCommission);
router.get('/my-stats', authMiddleware, inviteEventController.getMyInviteStats);

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────
router.get('/admin/all', authMiddleware, adminAuth, inviteEventController.adminGetAllInvites);
router.put('/admin/:inviteId/commission', authMiddleware, adminAuth, inviteEventController.adminUpdateCommission);

module.exports = router;