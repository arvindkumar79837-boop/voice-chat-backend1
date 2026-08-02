const express = require('express');
const router = express.Router();
const treasureHuntController = require('../controllers/treasureHuntController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// ─── TREASURE HUNT ROUTES ──────────────────────────────────────────────
router.post('/create', authMiddleware, adminAuth, treasureHuntController.createTreasureHunt);
router.get('/list', authMiddleware, treasureHuntController.getTreasureHunts);
router.get('/active', authMiddleware, treasureHuntController.getActiveTreasureHunt);
router.get('/:huntId', authMiddleware, treasureHuntController.getTreasureHuntById);
router.post('/:huntId/collect-key', authMiddleware, treasureHuntController.collectTreasureKey);
router.get('/admin/all', authMiddleware, adminAuth, treasureHuntController.adminGetAllTreasureHunts);

module.exports = router;