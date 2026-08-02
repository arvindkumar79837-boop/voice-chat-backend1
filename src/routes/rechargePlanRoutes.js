const express = require('express');
const router = express.Router();
const { verifyOwner } = require('../middlewares/adminMiddleware');
const rechargePlanController = require('../controllers/rechargePlanController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// PUBLIC — mobile app ke liye sirf active plans
router.get('/', validatePagination(), rechargePlanController.listPlans);

// OWNER ONLY — admin CRUD
router.get('/admin/all', validatePagination(), verifyOwner, rechargePlanController.listAllPlans);
router.post('/admin/create', verifyOwner, rechargePlanController.createPlan);
router.put('/admin/:id', validateObjectId('id'), verifyOwner, rechargePlanController.updatePlan);
router.delete('/admin/:id', verifyOwner, rechargePlanController.deletePlan);

module.exports = router;
