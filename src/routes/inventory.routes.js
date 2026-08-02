const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.get('/', validatePagination(), authMiddleware, inventoryController.getInventory);
router.post('/use/:itemId', validateObjectId('itemId'), validateNumber('quantity', { required: false, min: 1 }), authMiddleware, inventoryController.useItem);
router.delete('/:itemId', authMiddleware, inventoryController.removeItem);

module.exports = router;