const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const auth = require('../middlewares/auth.middleware');

router.get('/faq', supportController.getFAQs);
router.get('/tickets', auth, supportController.getTickets);
router.post('/ticket/create', auth, supportController.createTicket);
router.post('/message', auth, supportController.sendMessage);

module.exports = router;