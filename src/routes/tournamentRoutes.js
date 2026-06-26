const express = require('express');
const router = express.Router();
const tournamentController = require('../controllers/tournamentController');
const championshipController = require('../controllers/championshipController');
const auth = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');

// ─── TOURNAMENT ROUTES ──────────────────────────────────────────────────
router.post('/create', auth, adminAuth, tournamentController.createTournament);
router.get('/list', auth, tournamentController.getTournaments);
router.get('/:tournamentId', auth, tournamentController.getTournamentById);
router.post('/:tournamentId/register', auth, tournamentController.registerForTournament);
router.post('/:tournamentId/score', auth, tournamentController.updateTournamentScore);
router.post('/:tournamentId/complete', auth, adminAuth, tournamentController.completeTournament);
router.get('/:tournamentId/leaderboard', auth, tournamentController.getTournamentLeaderboard);
router.get('/admin/all', auth, adminAuth, tournamentController.adminGetAllTournaments);

// ─── CHAMPIONSHIP ROUTES ────────────────────────────────────────────────
router.post('/championship/create', auth, adminAuth, championshipController.createChampionship);
router.get('/championship/list', auth, championshipController.getChampionships);
router.get('/championship/:championshipId', auth, championshipController.getChampionshipById);
router.post('/championship/:championshipId/qualify', auth, championshipController.qualifyForChampionship);
router.post('/championship/:championshipId/complete', auth, adminAuth, championshipController.completeChampionship);
router.get('/championship/:championshipId/leaderboard', auth, championshipController.getChampionshipLeaderboard);
router.post('/championship/:championshipId/claim', auth, championshipController.claimChampionshipRewards);
router.get('/championship/admin/all', auth, adminAuth, championshipController.adminGetAllChampionships);

module.exports = router;