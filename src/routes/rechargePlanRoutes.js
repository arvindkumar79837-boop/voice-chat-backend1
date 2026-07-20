const express = require('express');
const router = express.Router();
const { verifyOwner } = require('../middlewares/adminMiddleware');
const rechargePlanController = require('../controllers/rechargePlanController');

// PUBLIC — mobile app ke liye sirf active plans
router.get('/', rechargePlanController.listPlans);

// OWNER ONLY — admin CRUD
router.get('/admin/all', verifyOwner, rechargePlanController.listAllPlans);
router.post('/admin/create', verifyOwner, rechargePlanController.createPlan);
router.put('/admin/:id', verifyOwner, rechargePlanController.updatePlan);
router.delete('/admin/:id', verifyOwner, rechargePlanController.deletePlan);

module.exports = router;
