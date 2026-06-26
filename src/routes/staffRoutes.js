const express = require('express');
const router = express.Router();
const { verifyOwner } = require('../middlewares/adminMiddleware');
const staffController = require('../controllers/staffController');

// 🌐 PUBLIC STAFF ROUTE
router.post('/login', staffController.loginStaff);

// ⚠️ STRICTLY OWNER ONLY ROUTE
router.post('/create', verifyOwner, staffController.createStaff);
router.get('/list', verifyOwner, staffController.getStaffList);
router.put('/update/:id', verifyOwner, staffController.updateStaff);
router.delete('/delete/:id', verifyOwner, staffController.deleteStaff);

// POST /api/admin/staff/change-password/:id - Owner force password change (bypasses lock)
router.post('/change-password/:id', verifyAdmin, staffController.changeStaffPassword);

// GET /api/admin/staff/roles - Get role hierarchy
router.get('/roles', staffController.getAdminRoles);

module.exports = router;
