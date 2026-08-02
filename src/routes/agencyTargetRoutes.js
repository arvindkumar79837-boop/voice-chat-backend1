const express = require('express');
const router = express.Router();
const { verifyOwner } = require('../middlewares/adminMiddleware');
const agencyTargetController = require('../controllers/agencyTargetController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// Owner-only CRUD
router.post('/', verifyOwner, agencyTargetController.createTarget);
router.get('/', verifyOwner, agencyTargetController.listTargets);
router.put('/:id', validateObjectId('id'), verifyOwner, agencyTargetController.updateTarget);
router.get('/:agencyId/dashboard', verifyOwner, agencyTargetController.getAgencyDashboard);

module.exports = router;
