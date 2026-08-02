const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const momentController = require('../controllers/momentController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// All moment routes require authentication
router.use(authMiddleware);

router.get('/', validatePagination(), asyncHandler(momentController.getMomentsFeed));
router.post('/create', validateString('content', { required: true, maxLength: 500 }), validateAllowedFields(['content']), asyncHandler(momentController.createMoment));
router.get('/search', validatePagination(), asyncHandler(momentController.searchMoments));
router.get('/:momentId', validateObjectId('momentId'), validatePagination(), asyncHandler(momentController.getMoment));
router.post('/:momentId/like', validateObjectId('momentId'), asyncHandler(momentController.likeMoment));
router.post('/:momentId/unlike', validateObjectId('momentId'), asyncHandler(momentController.unlikeMoment));
router.post('/:momentId/comment', validateObjectId('momentId'), validateString('text', { required: true, maxLength: 500 }), validateAllowedFields(['text']), asyncHandler(momentController.addComment));
router.delete('/:momentId/comment/:commentId', validateObjectId('momentId'), validateObjectId('commentId'), asyncHandler(momentController.deleteComment));
router.delete('/:momentId', validateObjectId('momentId'), asyncHandler(momentController.deleteMoment));

module.exports = router;