const express = require('express');
const router = express.Router();
const { verifyStaff, verifyOwner } = require('../middlewares/adminMiddleware');
const ctrl = require('../controllers/legalController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.get('/document/:type', validatePagination(), ctrl.getDocument);
router.get('/documents', validatePagination(), ctrl.getAllDocuments);
router.post('/document', validateEnum('documentType', ['privacy', 'terms', 'refund', 'eula'], { required: true }), verifyStaff, ctrl.upsertDocument);
router.post('/accept', validateEnum('documentType', ['privacy', 'terms', 'refund', 'eula'], { required: true }), ctrl.acceptDocument);
router.post('/request-deletion', ctrl.requestDeletion);
router.post('/cancel-deletion', ctrl.cancelDeletion);

module.exports = router;
