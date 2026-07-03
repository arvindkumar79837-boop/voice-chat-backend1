const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const agentController = require('../controllers/agentController');

router.use(authMiddleware);

router.post('/agents/add', agentController.addAgent);
router.get('/agents', agentController.listAgents);
router.put('/agents/:agentId', agentController.updateAgent);
router.delete('/agents/:agentId', agentController.deleteAgent);
router.get('/agents/:agentId/performance', agentController.getAgentPerformance);

module.exports = router;