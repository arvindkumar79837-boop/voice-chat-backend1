const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middlewares/auth.middleware');

router.post('/complete-profile', auth, userController.updateProfile);
router.get('/center', auth, userController.getUserCenter);
router.post('/equip-frame', auth, userController.equipFrame);

module.exports = router;
