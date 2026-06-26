// ═══════════════════════════════════════════════════════════════════════════
// CONTROLLER: StaffController — Full 15+ role management with Owner enforcement
// Password modification strictly locked under Owner control
// ═══════════════════════════════════════════════════════════════════════════

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');
const AuditLog = require('../models/AuditLog');
const { ROLE_HIERARCHY, ROLES, ALL_PERMISSIONS, DEFAULT_PERMISSIONS } = Staff;

/**
 * POST /api/admin/staff/create
 * Owner/Super Admin only: Create a new staff account
 */
exports.createStaff = async (req, res) => {
  try {
    const { uid, loginId, password, name, email, phone, role, permissions, assignedCountry, notes } = req.body;

    if (!uid || !loginId || !password || !role) {
      return res.status(400).json({ success: false, message: 'UID, Login ID, password, and role required' });
    }

    if (!ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: `Invalid role. Must be one of: ${ROLES.join(', ')}` });
    }

    // Check if staff already exists
    const existingStaff = await Staff.findOne({ $or: [{ uid }, { loginId }] });
    if (existingStaff) {
      return res.status(400).json({ success: false, message: 'Staff with this UID or Login ID already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Determine default permissions based on role
    const defaultPerms = DEFAULT_PERMISSIONS[role] || [];
    // If custom permissions provided, intersect with role's allowed permissions
    let finalPermissions = defaultPerms;
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      if (req.user?.role === 'owner' || req.user?.role === 'super_admin') {
        finalPermissions = permissions;
      } else {
        // Non-owner can only assign permissions that exist in their own set
        finalPermissions = permissions.filter(p => (req.user?.permissions || []).includes(p));
      }
    }

    const newStaff = new Staff({
      uid,
      loginId,
      password: hashedPassword,
      name: name || '',
      email: email || '',
      phone: phone || '',
      role,
      permissions: finalPermissions,
      assignedCountry: assignedCountry || '',
      notes: notes || '',
      createdBy: req.user?.userId || 'OWNER',
    });
    await newStaff.save();

    await AuditLog.create({
      action: 'STAFF_CREATE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Created staff account ${loginId} with role ${role}`,
      metadata: { uid, loginId, role, assignedCountry },
    });

    return res.status(201).json({
      success: true,
      message: `Staff account created for ${loginId} (${role})`,
      data: { uid, loginId, name, role, permissions: finalPermissions },
    });
  } catch (error) {
    console.error('Staff Creation Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/admin/staff/login
 * Staff Login
 */
exports.loginStaff = async (req, res) => {
  try {
    const { uid, loginId } = req.body;

    if (!uid) {
      return res.status(400).json({ success: false, message: 'Firebase UID required' });
    }

    const query = { uid };
    if (loginId) query.loginId = loginId;

    const staff = await Staff.findOne(query);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'No staff account found for this UID' });
    }

    if (!staff.isActive) {
      return res.status(403).json({ success: false, message: 'Account disabled. Contact Owner.' });
    }

    // Update last login
    staff.lastLoginAt = new Date();
    staff.loginHistory.push({
      ip: req.ip || req.connection?.remoteAddress || '',
      userAgent: req.headers['user-agent'] || '',
    });
    await staff.save();

    const token = jwt.sign(
      {
        id: staff._id,
        uid: staff.uid,
        role: staff.role,
        roleLevel: staff.roleLevel,
        isStaff: true,
        permissions: staff.permissions,
      },
      process.env.JWT_SECRET || 'arvind_party_super_secret_key',
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      token,
      staff: {
        _id: staff._id,
        uid: staff.uid,
        loginId: staff.loginId,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        roleLevel: staff.roleLevel,
        permissions: staff.permissions,
        isActive: staff.isActive,
        isOwnerLocked: staff.isOwnerLocked,
        assignedCountry: staff.assignedCountry,
      },
    });
  } catch (error) {
    console.error('Staff Login Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * GET /api/admin/staff/list
 * List all staff accounts
 */
exports.getStaffList = async (req, res) => {
  try {
    const staffList = await Staff.find({}, { password: 0 }).sort({ roleLevel: -1, createdAt: -1 });
    return res.status(200).json({ success: true, data: staffList });
  } catch (error) {
    console.error('Get Staff List Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * PUT /api/admin/staff/update/:id
 * Update staff account (Owner-enforced password lock)
 */
exports.updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, permissions, isActive, isOwnerLocked, name, email, phone, assignedCountry, notes, password } = req.body;

    const staff = await Staff.findById(id);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });

    const requesterRole = req.user?.role || '';
    const requesterLevel = ROLE_HIERARCHY[requesterRole]?.level || 0;

    // Owner-enforced password lock: only Owner can change passwords
    if (password !== undefined) {
      if (requesterRole !== 'owner' && staff.isOwnerLocked) {
        return res.status(403).json({
          success: false,
          message: 'Password change blocked by Owner enforcement. Only the Owner can change passwords for this account.',
        });
      }
      if (requesterRole === 'owner' || !staff.isOwnerLocked) {
        staff.password = await bcrypt.hash(password, 12);
      }
    }

    if (role !== undefined) {
      if (!ROLES.includes(role)) {
        return res.status(400).json({ success: false, message: `Invalid role: ${role}` });
      }
      // Only owner/super_admin can change roles
      if (requesterLevel < 80) {
        return res.status(403).json({ success: false, message: 'Insufficient level to change role' });
      }
      staff.role = role;
      // Reset permissions to default for new role unless custom provided
      if (!permissions) {
        staff.permissions = DEFAULT_PERMISSIONS[role] || [];
      }
    }

    if (isOwnerLocked !== undefined) {
      if (requesterRole !== 'owner') {
        return res.status(403).json({ success: false, message: 'Only Owner can set password lock' });
      }
      staff.isOwnerLocked = isOwnerLocked;
    }

    // Update other fields based on requester permissions
    if (name !== undefined && (req.user?.permissions || []).includes('staff.edit')) staff.name = name;
    if (email !== undefined && (req.user?.permissions || []).includes('staff.edit')) staff.email = email;
    if (phone !== undefined && (req.user?.permissions || []).includes('staff.edit')) staff.phone = phone;
    if (assignedCountry !== undefined) staff.assignedCountry = assignedCountry;
    if (notes !== undefined) staff.notes = notes;
    if (permissions !== undefined && (req.user?.permissions || []).includes('staff.edit')) {
      staff.permissions = permissions;
    }
    if (isActive !== undefined && (req.user?.permissions || []).includes('staff.edit')) staff.isActive = isActive;

    await staff.save();

    await AuditLog.create({
      action: 'STAFF_UPDATE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Updated staff ${staff.loginId}`,
      metadata: { staffId: id, changes: Object.keys(req.body) },
    });

    const staffData = staff.toObject();
    delete staffData.password;
    return res.status(200).json({ success: true, message: 'Staff updated', data: staffData });
  } catch (error) {
    console.error('Update Staff Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * DELETE /api/admin/staff/delete/:id
 * Owner only: Delete a staff account
 */
exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user?.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Only Owner can delete staff accounts' });
    }

    const staff = await Staff.findByIdAndDelete(id);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });

    await AuditLog.create({
      action: 'STAFF_DELETE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Deleted staff ${staff.loginId} (${staff.role})`,
      metadata: { staffId: id, loginId: staff.loginId },
    });

    return res.status(200).json({ success: true, message: 'Staff deleted permanently' });
  } catch (error) {
    console.error('Delete Staff Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/admin/staff/change-password/:id
 * Owner only: Force change staff password (bypasses lock)
 */
exports.changeStaffPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (req.user?.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Only Owner can force-change passwords' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const staff = await Staff.findById(id);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });

    staff.password = await bcrypt.hash(newPassword, 12);
    staff.isOwnerLocked = true; // Lock password after owner change
    await staff.save();

    await AuditLog.create({
      action: 'STAFF_PASSWORD_CHANGE',
      performedBy: req.user?.userId || 'OWNER',
      details: `Owner changed password for staff ${staff.loginId}`,
      metadata: { staffId: id, loginId: staff.loginId },
    });

    return res.status(200).json({ success: true, message: 'Password changed and locked by Owner' });
  } catch (error) {
    console.error('changeStaffPassword Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * GET /api/admin/staff/roles
 * Get all available roles with hierarchy info
 */
exports.getAdminRoles = async (req, res) => {
  try {
    const hierarchy = Staff.getRoleHierarchy();
    const rolesWithStaffCount = await Promise.all(
      Object.entries(hierarchy).map(async ([roleKey, roleInfo]) => {
        const count = await Staff.countDocuments({ role: roleKey });
        return { role: roleKey, ...roleInfo, staffCount: count, defaultPermissions: DEFAULT_PERMISSIONS[roleKey] || [] };
      })
    );
    return res.status(200).json({
      success: true,
      data: {
        hierarchy,
        roles: rolesWithStaffCount,
        allPermissions: ALL_PERMISSIONS,
      },
    });
  } catch (error) {
    console.error('Get Admin Roles Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/admin/staff/roles/create
 * Create a staff with a specific role (admin convenience)
 */
exports.createAdminRole = async (req, res) => {
  try {
    const { uid, loginId, password, role, permissions } = req.body;
    return exports.createStaff({ ...req, body: { uid, loginId, password, role, permissions } }, res);
  } catch (error) {
    console.error('Create Admin Role Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * PUT /api/admin/staff/roles/update/:id
 * Update role and permissions
 */
exports.updateAdminRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, permissions } = req.body;
    return exports.updateStaff({ ...req, params: { id }, body: { role, permissions } }, res);
  } catch (error) {
    console.error('Update Admin Role Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.searchUser = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ success: false, message: 'Search query required' });

    const users = await require('../models/User').find({
      $or: [
        { uid: { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } },
      ],
    }).limit(20);

    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error('Search User Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const AuditLog = require('../models/AuditLog');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const action = req.query.action || '';

    const query = {};
    if (action) query.action = action;

    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get Audit Logs Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};