const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { authMiddleware } = require('../middlewares/auth.middleware');
const agencyController = require('../controllers/agencyController');

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

// GET  /api/agency/commission-tiers — Commission tier info
router.get('/commission-tiers', asyncHandler(async (req, res) => {
  const tiers = [
    { level: 1, name: 'Bronze', minEarnings: 0, commission: 10 },
    { level: 2, name: 'Silver', minEarnings: 10000, commission: 12 },
    { level: 3, name: 'Gold', minEarnings: 50000, commission: 15 },
    { level: 4, name: 'Platinum', minEarnings: 100000, commission: 18 },
    { level: 5, name: 'Diamond', minEarnings: 500000, commission: 20 },
  ];
  res.json({ success: true, tiers });
}));

module.exports = router;
