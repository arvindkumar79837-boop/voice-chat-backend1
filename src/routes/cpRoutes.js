const express = require('express');
const router = express.Router();
const cpController = require('../controllers/cpController');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.get('/mine', authMiddleware, cpController.getMyCp);
router.post('/bind', authMiddleware, cpController.bindCp);

module.exports = router;