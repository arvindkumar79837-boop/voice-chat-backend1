const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/premiumSubscriptionController');
const { authMiddleware, verifyStaff } = require('../middlewares/adminMiddleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// ─── ADMIN/OWNER: Tier CRUD ───────────────────────────────────────
router.post('/tiers',        validateString('name', { required: true, maxLength: 100 }), validateNumber('price', { required: true, min: 0 }), validateNumber('duration', { required: true, min: 1 }), authMiddleware, verifyStaff, ctrl.createTier);
router.put('/tiers/:tierId', validateObjectId('tierId'), validateString('name', { required: true, maxLength: 100 }), validateNumber('price', { required: true, min: 0 }), validateNumber('duration', { required: true, min: 1 }), authMiddleware, verifyStaff, ctrl.updateTier);
router.delete('/tiers/:tierId', validateObjectId('tierId'), authMiddleware, verifyStaff, ctrl.deleteTier);
router.get('/tiers',         validatePagination(), ctrl.listTiers);
router.get('/tiers/:tierId', validatePagination(), ctrl.getTier);

// ─── USER: Subscription ───────────────────────────────────────────
router.post('/verify-play-subscription', validateString('purchaseToken', { required: true }), validateAllowedFields(['purchaseToken']), authMiddleware, ctrl.verifyPlaySubscription);
router.post('/claim-monthly-coins',      authMiddleware, validateAllowedFields([]), ctrl.claimMonthlyCoins);
router.get('/my-subscription',           validatePagination(), authMiddleware, ctrl.getMySubscription);

module.exports = router;
