const express = require('express');
const router = express.Router();
const luckyDrawController = require('../controllers/luckyDrawController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────
router.get('/active', validatePagination(), authMiddleware, luckyDrawController.getActiveLuckyDraws);
router.get('/rewards', validatePagination(), authMiddleware, luckyDrawController.getActiveLuckyDraws);
router.get('/:id', validatePagination(), authMiddleware, luckyDrawController.getLuckyDrawById);
router.post('/spin', authMiddleware, luckyDrawController.spinWheel);
router.post('/:drawId/spin', validateObjectId('drawId'), authMiddleware, luckyDrawController.spinWheel);

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────
router.get('/admin/all', validatePagination(), authMiddleware, adminAuth, luckyDrawController.adminGetAll);
router.post('/admin/create', validateString('name', { required: true, maxLength: 200 }), validateNumber('tickets', { required: true, min: 1 }), authMiddleware, adminAuth, luckyDrawController.createLuckyDraw);
router.put('/admin/:id', validateObjectId('id'), authMiddleware, adminAuth, luckyDrawController.updateLuckyDraw);
router.delete('/admin/:id', authMiddleware, adminAuth, luckyDrawController.deleteLuckyDraw);

module.exports = router;