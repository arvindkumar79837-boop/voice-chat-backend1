const express = require('express');
const router = express.Router();
const levelController = require('../controllers/levelController');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.get('/:id/level', authMiddleware, levelController.getUserLevel);
router.post('/xp/add', authMiddleware, levelController.addExperience);

module.exports = router;