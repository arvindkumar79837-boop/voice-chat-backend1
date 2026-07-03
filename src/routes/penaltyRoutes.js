const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const penaltyController = require('../controllers/penaltyController');

router.use(authMiddleware);

router.post('/penalty/apply', penaltyController.applyPenalty);
router.get('/penalty/history/:hostId', penaltyController.getHostPenalties);
router.delete('/penalty/:penaltyId', penaltyController.removePenalty);
router.get('/penalty/summary', penaltyController.getMonthlyPenaltySummary);

module.exports = router;