const express = require('express');
const router = express.Router();
const { verifyStaff, verifyOwner } = require('../middlewares/adminMiddleware');
const ctrl = require('../controllers/legalController');

router.get('/document/:type', ctrl.getDocument);
router.get('/documents', ctrl.getAllDocuments);
router.post('/document', verifyStaff, ctrl.upsertDocument);
router.post('/accept', ctrl.acceptDocument);
router.post('/request-deletion', ctrl.requestDeletion);
router.post('/cancel-deletion', ctrl.cancelDeletion);

module.exports = router;
