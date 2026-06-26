const express = require('express');
const router = express.Router();
const treasureHuntController = require('../controllers/treasureHuntController');
const auth = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');

// ─── TREASURE HUNT ROUTES ──────────────────────────────────────────────
router.post('/create', auth, adminAuth, treasureHuntController.createTreasureHunt);
router.get('/list', auth, treasureHuntController.getTreasureHunts);
router.get('/active', auth, treasureHuntController.getActiveTreasureHunt);
router.get('/:huntId', auth, treasureHuntController.getTreasureHuntById);
router.post('/:huntId/collect-key', auth, treasureHuntController.collectTreasureKey);
router.get('/admin/all', auth, adminAuth, treasureHuntController.adminGetAllTreasureHunts);

module.exports = router;