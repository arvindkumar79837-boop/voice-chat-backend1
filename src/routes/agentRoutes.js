const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const agentController = require('../controllers/agentController');

router.use(auth);

router.post('/agents/add', agentController.addAgent);
router.get('/agents', agentController.listAgents);
router.put('/agents/:agentId', agentController.updateAgent);
router.delete('/agents/:agentId', agentController.deleteAgent);
router.get('/agents/:agentId/performance', agentController.getAgentPerformance);

module.exports = router;