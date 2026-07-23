const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { authMiddleware, verifyStaff } = require('../middlewares/adminMiddleware');
const agencyController = require('../controllers/agencyController');
const agencyCommissionController = require('../controllers/agencyCommissionController');
const { verifyOwner } = require('../middlewares/adminMiddleware');

// All agency routes require authentication
router.use(authMiddleware);

// GET  /api/agency          — Get current user's agency info
router.get('/', asyncHandler(agencyController.getMyAgency));

// POST /api/agency/create   — Create a new agency
router.post('/create', asyncHandler(agencyController.createAgency));

// GET  /api/agency/hosts    — List agency members/hosts
router.get('/hosts', asyncHandler(agencyController.listHosts));

// GET  /api/agency/earnings — Get agency earnings
router.get('/earnings', asyncHandler(agencyController.getEarnings));

// POST /api/agency/apply    — Apply/join an agency
router.post('/apply', asyncHandler(agencyController.applyForAgency));

// ─── AGENCY COMMISSION ─────────────────────────────────────────────────
router.get('/commission-tiers', verifyOwner, asyncHandler(agencyCommissionController.getCommissionTiers));
router.post('/commission-tiers', verifyOwner, asyncHandler(agencyCommissionController.createCommissionTier));
router.put('/commission-tiers/:tierId', verifyOwner, asyncHandler(agencyCommissionController.updateCommissionTier));
router.delete('/commission-tiers/:tierId', verifyOwner, asyncHandler(agencyCommissionController.deleteCommissionTier));
router.post('/commission/calculate', verifyOwner, asyncHandler(agencyCommissionController.calculateCommission));

module.exports = router;
