const express = require('express');
const router = express.Router();
const controller = require('../controllers/authSecure.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.post('/logout', authMiddleware, controller.logoutDevice);
router.post('/revoke-all-sessions', authMiddleware, controller.logoutDevice);
router.post('/admin/revoke-user-sessions', authMiddleware, controller.logoutDevice);

module.exports = router;
