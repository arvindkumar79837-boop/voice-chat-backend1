// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/controllers/adminAuthController.js
// NOTE: Admin Panel login is now handled by Firebase Auth on the frontend.
// This controller is kept for backward compatibility only.
// The frontend authenticates via Firebase, then calls /api/staff/login with
// the Firebase UID to get a backend JWT token.
// ═══════════════════════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');

/**
 * Admin Login — Now uses Firebase Auth flow.
 * 
 * The frontend handles Firebase Auth directly. After successful Firebase
 * authentication, the frontend should call POST /api/staff/login with
 * the Firebase UID to obtain a backend JWT.
 * 
 * This endpoint is kept for backward compatibility. It accepts a Firebase
 * UID and issues a backend JWT if the UID is registered as staff.
 */
exports.login = async (req, res) => {
  try {
    const { uid, idToken } = req.body;

    // Option 1: Firebase UID-based login (primary flow)
    if (uid) {
      const staff = await Staff.findOne({ uid });
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: 'No staff account found for this UID. Please contact the Owner.'
        });
      }

      if (!staff.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is disabled. Please contact the Owner.'
        });
      }

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

      return res.json({
        success: true,
        message: 'Login successful',
        token,
        role: staff.role,
        staff: {
          _id: staff._id,
          uid: staff.uid,
          loginId: staff.loginId,
          role: staff.role,
          permissions: staff.permissions
        }
      });
    }

    // Option 2: Firebase ID Token verification
    if (idToken) {
      try {
        const firebaseAdmin = require('../config/firebase');
        const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
        const firebaseUid = decodedToken.uid;

        const staff = await Staff.findOne({ uid: firebaseUid });
        if (!staff) {
          return res.status(404).json({
            success: false,
            message: 'No staff account found. Please contact the Owner.'
          });
        }

        if (!staff.isActive) {
          return res.status(403).json({
            success: false,
            message: 'Account is disabled. Please contact the Owner.'
          });
        }

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

        return res.json({
          success: true,
          message: 'Login successful',
          token,
          role: staff.role,
          staff: {
            _id: staff._id,
            uid: staff.uid,
            loginId: staff.loginId,
            role: staff.role,
            permissions: staff.permissions
          }
        });
      } catch (fbError) {
        return res.status(401).json({
          success: false,
          message: 'Invalid Firebase ID token'
        });
      }
    }

    // No valid auth method provided
    return res.status(400).json({
      success: false,
      message: 'Please provide a Firebase UID or ID token. Password-based login has been removed — use Firebase Auth on the frontend.'
    });
  } catch (e) {
    console.error('Admin Login Error:', e);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};