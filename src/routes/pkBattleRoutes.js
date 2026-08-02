const express = require('express');
const router = express.Router();
const pkBattleController = require('../controllers/pkBattle.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// All PK Battle routes require user authentication
router.use(authMiddleware);

router.post('/request', validateBodyObjectId('opponentId'), pkBattleController.requestBattle);
router.post('/accept', validateString('challengeToken', { required: true }), pkBattleController.acceptBattle);
router.post('/end', pkBattleController.endBattle); // Typically for admin/host

module.exports = router;