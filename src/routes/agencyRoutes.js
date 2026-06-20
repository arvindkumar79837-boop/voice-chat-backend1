const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const agencyController = require('../controllers/agencyController');

// All agency routes require authentication
router.use(auth);

// GET  /api/agency          — Get current user's agency info
router.get('/', agencyController.getMyAgency);

// POST /api/agency/create   — Create a new agency
router.post('/create', agencyController.createAgency);

// GET  /api/agency/hosts    — List agency members/hosts
router.get('/hosts', agencyController.listHosts);

// GET  /api/agency/earnings — Get agency earnings
router.get('/earnings', agencyController.getEarnings);

// POST /api/agency/apply    — Apply/join an agency
router.post('/apply', agencyController.applyForAgency);

module.exports = router;
