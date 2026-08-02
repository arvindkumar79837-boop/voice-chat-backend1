const express = require('express');
const router = express.Router();
const { verifyStaff, verifyOwner } = require('../middlewares/adminMiddleware');
const verifyAdmin = require('../middlewares/isAdmin');
const staffController = require('../controllers/staffController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// 🌐 PUBLIC STAFF ROUTES
router.post('/login', staffController.loginStaff); // Firebase UID-based (mobile)
router.post('/login-password', staffController.loginStaffPassword); // loginId + password (web panel)

// ⚠️ STRICTLY OWNER ONLY ROUTE
router.post('/create', validateString('name', { required: true, minLength: 2, maxLength: 50 }), validateEmail(), validatePhone(), validateEnum('role', ['admin', 'owner', 'staff', 'moderator'], { required: true }), verifyOwner, staffController.createStaff);
router.get('/list', validatePagination(), verifyOwner, staffController.getStaffList);
router.put('/update/:id', validateObjectId('id'), verifyOwner, staffController.updateStaff);
router.delete('/delete/:id', verifyOwner, staffController.deleteStaff);

// Owner-only: Search users by UID/name/phone for staff invite
router.get('/search', validatePagination(), verifyOwner, staffController.searchUser);

// Staff: Get own profile
router.get('/me', validatePagination(), verifyStaff, staffController.getMyProfile);

// POST /api/admin/staff/change-password/:id - Owner force password change (bypasses lock)
router.post('/change-password/:id', validateObjectId('id'), verifyAdmin, staffController.changeStaffPassword);

// GET /api/admin/staff/roles - Get role hierarchy
router.get('/roles', validatePagination(), verifyStaff, staffController.getAdminRoles);

module.exports = router;
