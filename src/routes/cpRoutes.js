const express = require('express');
const router = express.Router();
const cpController = require('../controllers/cpController');
const auth = require('../middlewares/auth.middleware');

router.get('/mine', auth, cpController.getMyCp);
router.post('/bind', auth, cpController.bindCp);

module.exports = router;