const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const familyController = require('../controllers/familyController');

router.get('/mine', auth, familyController.getMyFamily);
router.post('/create', auth, familyController.createFamily);
router.post('/join', auth, familyController.joinFamily);

module.exports = router;
