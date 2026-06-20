const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');

exports.createStaff = async (req, res) => {
  try {
    const { uid, loginId, password, role, permissions } = req.body;

    if (!uid || !loginId || !password || !role) {
      return res.status(400).json({ success: false, message: 'Missing required credentials or role' });
    }

    // Check if staff already exists
    const existingStaff = await Staff.findOne({ $or: [{ uid }, { loginId }] });
    if (existingStaff) {
      return res.status(400).json({ success: false, message: 'Staff with this UID or Login ID already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newStaff = new Staff({
      uid,
      loginId,
      password: hashedPassword,
      role,
      permissions
    });
    await newStaff.save();

    return res.status(200).json({
      success: true,
      message: `Staff account successfully created for UID: ${uid}`,
      data: {
        uid, loginId, role, permissions
      }
    });
  } catch (error) {
    console.error('Staff Creation Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * Staff Login — Firebase Auth based.
 * 
 * Since the Admin Panel login is handled by Firebase Auth on the frontend,
 * the backend only needs to verify the Firebase UID exists in the Staff
 * collection and issue a backend JWT for API access.
 * 
 * Accepts either:
 *   - { uid }            → lookup by Firebase UID
 *   - { loginId, uid }   → lookup by loginId + Firebase UID (extra safety)
 */
exports.loginStaff = async (req, res) => {
  try {
    const { uid, loginId } = req.body;

    // Firebase UID is required — the frontend gets it from Firebase Auth
    if (!uid) {
      return res.status(400).json({
        success: false,
        message: 'Firebase UID is required. Please authenticate via Firebase first.'
      });
    }

    // Find staff by Firebase UID
    const query = { uid };
    if (loginId) {
      query.loginId = loginId;
    }

    const staff = await Staff.findOne(query);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'No staff account found for this UID. Please contact the Owner to create a staff account.'
      });
    }

    if (!staff.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your staff account is disabled. Please contact the Owner.'
      });
    }

    // Issue backend JWT for API access
    const token = jwt.sign(
      {
        id: staff._id,
        uid: staff.uid,
        role: staff.role,
        isStaff: true,
        permissions: staff.permissions
      },
      process.env.JWT_SECRET || 'arvind_party_super_secret_key',
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      staff: {
        _id: staff._id,
        uid: staff.uid,
        loginId: staff.loginId,
        role: staff.role,
        permissions: staff.permissions,
        isActive: staff.isActive
      }
    });
  } catch (error) {
    console.error('Staff Login Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getStaffList = async (req, res) => {
  try {
    const staffList = await Staff.find({}, { password: 0 }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: staffList });
  } catch (error) {
    console.error('Get Staff List Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, permissions, isActive } = req.body;
    
    const staff = await Staff.findById(id);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });
    
    if (role !== undefined) staff.role = role;
    if (permissions !== undefined) staff.permissions = permissions;
    if (isActive !== undefined) staff.isActive = isActive;
    
    await staff.save();
    return res.status(200).json({ success: true, message: 'Staff updated successfully', data: staff });
  } catch (error) {
    console.error('Update Staff Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await Staff.findByIdAndDelete(id);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });
    
    return res.status(200).json({ success: true, message: 'Staff deleted successfully' });
  } catch (error) {
    console.error('Delete Staff Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};