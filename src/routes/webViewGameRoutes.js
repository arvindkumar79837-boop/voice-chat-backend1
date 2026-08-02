const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const webViewGameController = require('../controllers/webViewGameController');
const isAdmin = require('../middlewares/isAdmin');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.use(authMiddleware);

router.get('/games', webViewGameController.getAllGames);
router.get('/games/active', webViewGameController.getActiveGames);
router.get('/games/:gameId', webViewGameController.getGameById);
router.post('/games', isAdmin, webViewGameController.createGame);
router.put('/games/:gameId', validateObjectId('gameId'), isAdmin, webViewGameController.updateGame);
router.delete('/games/:gameId', isAdmin, webViewGameController.deleteGame);
router.post('/games/start-session', webViewGameController.startGameSession);
router.post('/games/end-session', webViewGameController.endGameSession);
router.get('/games/ledger', isAdmin, webViewGameController.getGameLedger);
router.get('/games/leaderboard', webViewGameController.getGameLeaderboard);

module.exports = router;