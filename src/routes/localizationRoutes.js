const express = require('express');
const router = express.Router();
const localizationController = require('../controllers/localizationController');
const { authMiddleware: authenticateToken } = require('../middlewares/auth.middleware');
const isAdmin = require('../middlewares/isAdmin');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.get('/translations', validatePagination(), localizationController.getTranslations);

router.get('/strings', validatePagination(), authenticateToken, isAdmin, localizationController.getAllStrings);

router.post('/strings', authenticateToken, isAdmin, validateString('key', { required: true, maxLength: 100 }), validateString('value', { required: true }), validateEnum('language', ['en', 'hi', 'es', 'fr', 'de', 'pt', 'ru', 'ja', 'ko', 'zh'], { required: true }), validateAllowedFields(['key', 'value', 'language']), localizationController.createString);

router.put('/strings/:id', validateObjectId('id'), authenticateToken, isAdmin, localizationController.updateString);

router.delete('/strings/:id', validateObjectId('id'), authenticateToken, isAdmin, localizationController.deleteString);

router.post('/strings/bulk-import', authenticateToken, isAdmin, validateAllowedFields(['strings']), localizationController.bulkImportStrings);

router.get('/categories', validatePagination(), authenticateToken, isAdmin, localizationController.getCategories);

router.get('/supported-languages', validatePagination(), localizationController.getSupportedLanguages);

module.exports = router;