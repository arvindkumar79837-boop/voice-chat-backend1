const express = require('express');
const router = express.Router();
const luckyDrawController = require('../controllers/luckyDrawController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────
router.get('/active', authMiddleware, luckyDrawController.getActiveLuckyDraws);
router.get('/:id', authMiddleware, luckyDrawController.getLuckyDrawById);
router.post('/:drawId/spin', authMiddleware, luckyDrawController.spinWheel);

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────
router.get('/admin/all', authMiddleware, adminAuth, luckyDrawController.adminGetAll);
router.post('/admin/create', authMiddleware, adminAuth, luckyDrawController.createLuckyDraw);
router.put('/admin/:id', authMiddleware, adminAuth, luckyDrawController.updateLuckyDraw);
router.delete('/admin/:id', authMiddleware, adminAuth, luckyDrawController.deleteLuckyDraw);

module.exports = router;