const express = require('express');
const router = express.Router();
const { verifyOwner } = require('../middlewares/adminMiddleware');
const agencyTargetController = require('../controllers/agencyTargetController');

// Owner-only CRUD
router.post('/', verifyOwner, agencyTargetController.createTarget);
router.get('/', verifyOwner, agencyTargetController.listTargets);
router.put('/:id', verifyOwner, agencyTargetController.updateTarget);
router.get('/:agencyId/dashboard', verifyOwner, agencyTargetController.getAgencyDashboard);

module.exports = router;
