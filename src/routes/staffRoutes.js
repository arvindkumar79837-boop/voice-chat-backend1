const express = require('express');
const router = express.Router();
const { verifyStaff, verifyOwner } = require('../middlewares/adminMiddleware');
const verifyAdmin = require('../middlewares/isAdmin');
const staffController = require('../controllers/staffController');

// 🌐 PUBLIC STAFF ROUTES
router.post('/login', staffController.loginStaff); // Firebase UID-based (mobile)
router.post('/login-password', staffController.loginStaffPassword); // loginId + password (web panel)

// ⚠️ STRICTLY OWNER ONLY ROUTE
router.post('/create', verifyOwner, staffController.createStaff);
router.get('/list', verifyOwner, staffController.getStaffList);
router.put('/update/:id', verifyOwner, staffController.updateStaff);
router.delete('/delete/:id', verifyOwner, staffController.deleteStaff);

// Owner-only: Search users by UID/name/phone for staff invite
router.get('/search', verifyOwner, staffController.searchUser);

// Staff: Get own profile
router.get('/me', verifyStaff, staffController.getMyProfile);

// POST /api/admin/staff/change-password/:id - Owner force password change (bypasses lock)
router.post('/change-password/:id', verifyAdmin, staffController.changeStaffPassword);

// GET /api/admin/staff/roles - Get role hierarchy
router.get('/roles', verifyStaff, staffController.getAdminRoles);

module.exports = router;
