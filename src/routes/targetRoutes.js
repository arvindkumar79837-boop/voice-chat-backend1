// ═══════════════════════════════════════════════════════════════════════════
// ROUTES: TargetManager — Streamer target cycles & 50-50 revenue split
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const targetManagerController = require('../controllers/targetManagerController');
const authMiddleware = require('../middlewares/auth.middleware');
const { verifyStaff } = require('../middlewares/adminMiddleware');
const verifyAdmin = require('../middlewares/isAdmin');

// Protect all routes
router.use(authMiddleware);
router.use(verifyStaff);

// POST /api/targets/create - Create a new target cycle
router.post('/create', verifyAdmin, targetManagerController.createTarget);

// PUT /api/targets/progress/:id - Update progress
router.put('/progress/:id', targetManagerController.updateProgress);

// POST /api/targets/exchange/:id - Request diamond exchange (streamer)
router.post('/exchange/:id', targetManagerController.requestDiamondExchange);

// POST /api/targets/approve-exchange/:targetId/:requestIndex - Approve exchange
router.post('/approve-exchange/:targetId/:requestIndex', verifyAdmin, targetManagerController.approveExchange);

// GET /api/targets - List targets with filters
router.get('/', targetManagerController.getTargets);

// GET /api/targets/:id - Get target detail
router.get('/:id', targetManagerController.getTargetDetail);

// POST /api/targets/auto-cycle - Auto-create cycles for all streamers
router.post('/auto-cycle', verifyAdmin, targetManagerController.autoCreateCycles);

module.exports = router;