// ═══════════════════════════════════════════════════════════════════════════
// ROUTES: TargetManager — Streamer target cycles & 50-50 revenue split
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const targetManagerController = require('../controllers/targetManagerController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { verifyStaff } = require('../middlewares/adminMiddleware');
const verifyAdmin = require('../middlewares/isAdmin');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// Protect all routes
router.use(authMiddleware);
router.use(verifyStaff);

// POST /api/targets/create - Create a new target cycle
router.post('/create', verifyAdmin, validateString('name', { required: true, maxLength: 100 }), validateNumber('targetAmount', { required: true, min: 0 }), validateNumber('durationDays', { required: true, min: 1 }), validateEnum('status', ['active', 'completed', 'cancelled'], { required: true }), validateAllowedFields(['name', 'targetAmount', 'durationDays', 'status', 'streamerId']), targetManagerController.createTarget);

// PUT /api/targets/progress/:id - Update progress
router.put('/progress/:id', validateObjectId('id'), validateNumber('progress', { required: true, min: 0, max: 100 }), validateAllowedFields(['progress']), targetManagerController.updateProgress);

// POST /api/targets/exchange/:id - Request diamond exchange (streamer)
router.post('/exchange/:id', validateObjectId('id'), validateNumber('diamondAmount', { required: true, min: 1 }), validateAllowedFields(['diamondAmount']), targetManagerController.requestDiamondExchange);

// POST /api/targets/approve-exchange/:targetId/:requestIndex - Approve exchange
router.post('/approve-exchange/:targetId/:requestIndex', validateObjectId('targetId'), validateNumber('requestIndex', { required: true, min: 0 }), verifyAdmin, targetManagerController.approveExchange);

// GET /api/targets - List targets with filters
router.get('/', validatePagination(), targetManagerController.getTargets);

// GET /api/targets/:id - Get target detail
router.get('/:id', validateObjectId('id'), validatePagination(), targetManagerController.getTargetDetail);

// POST /api/targets/auto-cycle - Auto-create cycles for all streamers
router.post('/auto-cycle', verifyAdmin, validateAllowedFields([]), targetManagerController.autoCreateCycles);

module.exports = router;