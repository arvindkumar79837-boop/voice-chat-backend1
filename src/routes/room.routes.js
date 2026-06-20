const express = require('express');
const router = express.Router();
const roomController = require('../controllers/room.controller');
const auth = require('../middlewares/auth.middleware');

router.get('/live', roomController.getLiveRooms);
router.post('/create', auth, roomController.createRoom);

module.exports = router;