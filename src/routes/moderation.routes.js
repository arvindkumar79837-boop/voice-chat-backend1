const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { verifyStaff } = require('../middlewares/adminMiddleware');
const moderationController = require('../controllers/moderationController');
const contentModerationController = require('../controllers/contentModerationController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.get('/reports', validatePagination(), verifyStaff, contentModerationController.getReports);
router.post('/report', validateEnum('type', ['user', 'moment', 'gift', 'room', 'message'], { required: true }), validateBodyObjectId('targetId'), validateString('reason', { required: false, maxLength: 500 }), authMiddleware, contentModerationController.reportContent);
router.post('/block', validateBodyObjectId('targetUserId'), authMiddleware, moderationController.blockUser);
router.put('/resolve/:reportId', validateObjectId('reportId'), verifyStaff, contentModerationController.resolveReport);
router.put('/dismiss/:reportId', validateObjectId('reportId'), verifyStaff, contentModerationController.dismissReport);

module.exports = router;
