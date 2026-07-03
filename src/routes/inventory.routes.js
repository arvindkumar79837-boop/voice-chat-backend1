const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.get('/', authMiddleware, inventoryController.getInventory);
router.post('/use/:itemId', authMiddleware, inventoryController.useItem);
router.delete('/:itemId', authMiddleware, inventoryController.removeItem);

module.exports = router;