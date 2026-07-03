const express = require('express');
const router = express.Router();
const tournamentController = require('../controllers/tournamentController');
const championshipController = require('../controllers/championshipController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');

// ─── TOURNAMENT ROUTES ──────────────────────────────────────────────────
router.post('/create', authMiddleware, adminAuth, tournamentController.createTournament);
router.get('/list', authMiddleware, tournamentController.getTournaments);
router.get('/:tournamentId', authMiddleware, tournamentController.getTournamentById);
router.post('/:tournamentId/register', authMiddleware, tournamentController.registerForTournament);
router.post('/:tournamentId/score', authMiddleware, tournamentController.updateTournamentScore);
router.post('/:tournamentId/complete', authMiddleware, adminAuth, tournamentController.completeTournament);
router.get('/:tournamentId/leaderboard', authMiddleware, tournamentController.getTournamentLeaderboard);
router.get('/admin/all', authMiddleware, adminAuth, tournamentController.adminGetAllTournaments);

// ─── CHAMPIONSHIP ROUTES ────────────────────────────────────────────────
router.post('/championship/create', authMiddleware, adminAuth, championshipController.createChampionship);
router.get('/championship/list', authMiddleware, championshipController.getChampionships);
router.get('/championship/:championshipId', authMiddleware, championshipController.getChampionshipById);
router.post('/championship/:championshipId/qualify', authMiddleware, championshipController.qualifyForChampionship);
router.post('/championship/:championshipId/complete', authMiddleware, adminAuth, championshipController.completeChampionship);
router.get('/championship/:championshipId/leaderboard', authMiddleware, championshipController.getChampionshipLeaderboard);
router.post('/championship/:championshipId/claim', authMiddleware, championshipController.claimChampionshipRewards);
router.get('/championship/admin/all', authMiddleware, adminAuth, championshipController.adminGetAllChampionships);

module.exports = router;