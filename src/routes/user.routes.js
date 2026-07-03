const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.post('/complete-profile', authMiddleware, userController.updateProfile);
router.get('/center', authMiddleware, userController.getUserCenter);
router.post('/equip-frame', authMiddleware, userController.equipFrame);

module.exports = router;
