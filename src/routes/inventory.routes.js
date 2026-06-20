const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const auth = require('../middlewares/auth.middleware');

router.get('/', auth, inventoryController.getInventory);
router.post('/use/:itemId', auth, inventoryController.useItem);
router.delete('/:itemId', auth, inventoryController.removeItem);

module.exports = router;