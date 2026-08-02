const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { authMiddleware, verifyStaff } = require('../middlewares/adminMiddleware');
const agencyController = require('../controllers/agencyController');
const agencyCommissionController = require('../controllers/agencyCommissionController');
const { verifyOwner } = require('../middlewares/adminMiddleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// All agency routes require authentication
router.use(authMiddleware);

// GET  /api/agency          — Get current user's agency info
router.get('/', validatePagination(), asyncHandler(agencyController.getMyAgency));

// POST /api/agency/create   — Create a new agency
router.post('/create', asyncHandler(agencyController.createAgency));

// GET  /api/agency/hosts    — List agency members/hosts
router.get('/hosts', validatePagination(), asyncHandler(agencyController.listHosts));

// GET  /api/agency/earnings — Get agency earnings
router.get('/earnings', validatePagination(), asyncHandler(agencyController.getEarnings));

// POST /api/agency/apply    — Apply/join an agency
router.post('/apply', validateString('agencyId', { required: true }), asyncHandler(agencyController.applyForAgency));

// ─── AGENCY COMMISSION ─────────────────────────────────────────────────
router.get('/commission-tiers', validatePagination(), verifyOwner, asyncHandler(agencyCommissionController.getCommissionTiers));
router.post('/commission-tiers', verifyOwner, asyncHandler(agencyCommissionController.createCommissionTier));
router.put('/commission-tiers/:tierId', validateObjectId('tierId'), verifyOwner, asyncHandler(agencyCommissionController.updateCommissionTier));
router.delete('/commission-tiers/:tierId', verifyOwner, asyncHandler(agencyCommissionController.deleteCommissionTier));
router.post('/commission/calculate', validateBodyObjectId('userId'), validateNumber('amount', { required: true, min: 0 }), verifyOwner, asyncHandler(agencyCommissionController.calculateCommission));

module.exports = router;
