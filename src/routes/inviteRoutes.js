const express = require('express');
const router = express.Router();
const inviteEventController = require('../controllers/inviteEventController');
const auth = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────
router.post('/generate', auth, inviteEventController.generateInviteLink);
router.post('/register', auth, inviteEventController.registerViaInvite);
router.post('/commission', auth, inviteEventController.processRechargeCommission);
router.get('/my-stats', auth, inviteEventController.getMyInviteStats);

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────
router.get('/admin/all', auth, adminAuth, inviteEventController.adminGetAllInvites);
router.put('/admin/:inviteId/commission', auth, adminAuth, inviteEventController.adminUpdateCommission);

module.exports = router;