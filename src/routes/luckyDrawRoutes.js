const express = require('express');
const router = express.Router();
const luckyDrawController = require('../controllers/luckyDrawController');
const auth = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────
router.get('/active', auth, luckyDrawController.getActiveLuckyDraws);
router.get('/:id', auth, luckyDrawController.getLuckyDrawById);
router.post('/:drawId/spin', auth, luckyDrawController.spinWheel);

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────
router.get('/admin/all', auth, adminAuth, luckyDrawController.adminGetAll);
router.post('/admin/create', auth, adminAuth, luckyDrawController.createLuckyDraw);
router.put('/admin/:id', auth, adminAuth, luckyDrawController.updateLuckyDraw);
router.delete('/admin/:id', auth, adminAuth, luckyDrawController.deleteLuckyDraw);

module.exports = router;