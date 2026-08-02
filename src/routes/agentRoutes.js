const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const agentController = require('../controllers/agentController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.use(authMiddleware);

router.post('/agents/add', agentController.addAgent);
router.get('/agents', validatePagination(), agentController.listAgents);
router.put('/agents/:agentId', validateObjectId('agentId'), agentController.updateAgent);
router.delete('/agents/:agentId', agentController.deleteAgent);
router.get('/agents/:agentId/performance', validatePagination(), agentController.getAgentPerformance);

module.exports = router;