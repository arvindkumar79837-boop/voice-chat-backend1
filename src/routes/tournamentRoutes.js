const express = require('express');
const router = express.Router();
const tournamentController = require('../controllers/tournamentController');
const championshipController = require('../controllers/championshipController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// ─── TOURNAMENT ROUTES ──────────────────────────────────────────────────
router.post('/create', validateString('name', { required: true, maxLength: 200 }), validateDate('startDate', { required: true }), validateDate('endDate', { required: true }), authMiddleware, adminAuth, tournamentController.createTournament);
router.get('/list', validatePagination(), authMiddleware, tournamentController.getTournaments);
router.get('/:tournamentId', validatePagination(), authMiddleware, tournamentController.getTournamentById);
router.post('/:tournamentId/register', validateObjectId('tournamentId'), authMiddleware, tournamentController.registerForTournament);
router.post('/:tournamentId/score', validateObjectId('tournamentId'), validateBodyObjectId('participantId'), validateNumber('score', { required: true, min: 0 }), authMiddleware, tournamentController.updateTournamentScore);
router.post('/:tournamentId/complete', validateObjectId('tournamentId'), authMiddleware, adminAuth, tournamentController.completeTournament);
router.get('/:tournamentId/leaderboard', validatePagination(), authMiddleware, tournamentController.getTournamentLeaderboard);
router.get('/admin/all', validatePagination(), authMiddleware, adminAuth, tournamentController.adminGetAllTournaments);

// ─── CHAMPIONSHIP ROUTES ────────────────────────────────────────────────
router.post('/championship/create', validateString('name', { required: true, maxLength: 200 }), authMiddleware, adminAuth, championshipController.createChampionship);
router.get('/championship/list', validatePagination(), authMiddleware, championshipController.getChampionships);
router.get('/championship/:championshipId', validatePagination(), authMiddleware, championshipController.getChampionshipById);
router.post('/championship/:championshipId/qualify', validateObjectId('championshipId'), authMiddleware, championshipController.qualifyForChampionship);
router.post('/championship/:championshipId/complete', validateObjectId('championshipId'), authMiddleware, adminAuth, championshipController.completeChampionship);
router.get('/championship/:championshipId/leaderboard', validatePagination(), authMiddleware, championshipController.getChampionshipLeaderboard);
router.post('/championship/:championshipId/claim', validateObjectId('championshipId'), authMiddleware, championshipController.claimChampionshipRewards);
router.get('/championship/admin/all', validatePagination(), authMiddleware, adminAuth, championshipController.adminGetAllChampionships);

module.exports = router;