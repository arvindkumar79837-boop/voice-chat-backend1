const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const authMiddleware = require('../middlewares/auth.middleware');

// All event routes require authentication
router.use(authMiddleware);

router.get('/list', eventController.getEvents);
router.get('/:eventId', eventController.getEvent);
router.post('/:eventId/join', eventController.joinEvent);
router.post('/:eventId/leave', eventController.leaveEvent);

module.exports = router;