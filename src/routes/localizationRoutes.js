const express = require('express');
const router = express.Router();
const localizationController = require('../controllers/localizationController');
const { authenticateToken, isAdmin } = require('../middlewares/auth.middleware');

router.get('/translations', localizationController.getTranslations);

router.get('/strings', authenticateToken, isAdmin, localizationController.getAllStrings);

router.post('/strings', authenticateToken, isAdmin, localizationController.createString);

router.put('/strings/:id', authenticateToken, isAdmin, localizationController.updateString);

router.delete('/strings/:id', authenticateToken, isAdmin, localizationController.deleteString);

router.post('/strings/bulk-import', authenticateToken, isAdmin, localizationController.bulkImportStrings);

router.get('/categories', authenticateToken, isAdmin, localizationController.getCategories);

router.get('/supported-languages', localizationController.getSupportedLanguages);

module.exports = router;