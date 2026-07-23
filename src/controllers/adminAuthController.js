const Logger = require('../utils/logger');
// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/controllers/adminAuthController.js
// ARVIND PARTY - ADVANCED ADMIN AUTH CONTROLLER
// Implements JWT + Refresh Tokens and 2-Factor Authentication for high-privilege roles.
// ═══════════════════════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');
const { verifyIdToken } = require('../config/firebase-admin');
const { verifyOTP } = require('../services/otp.service'); // Assuming Firebase OTP is used via a generic service

/**
 * Admin Login — Now uses Firebase Auth flow.
 * 
 * The frontend handles Firebase Auth directly. After successful Firebase
 * authentication, the frontend should call POST /api/staff/login with
 * the Firebase UID to obtain a backend JWT.
 */
exports.login = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Firebase ID token is required' });
    }
    let staffUid;
    try {
      const decodedToken = await verifyIdToken(idToken);
      staffUid = decodedToken.uid;
    } catch (fbError) {
      return res.status(401).json({ success: false, message: 'Invalid Firebase ID token' });
    }

    if (staffUid) {
      const staff = await Staff.findOne({ uid: staffUid });
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

      // Check if 2FA is required for this role
      const highPrivilegeRoles = ['ownerWeb', 'superAdminUid', 'globalManagerWeb'];
      if (highPrivilegeRoles.includes(staff.role)) {
        // HIGH-PRIVILEGE: 2FA MUST be set up — block login if not configured
        if (!staff.twoFactorEnabled) {
          return res.status(200).json({
            success: true,
            twoFactorSetupRequired: true,
            message: `Welcome, ${staff.name}. Two-factor authentication must be set up before you can access your account.`,
            staffId: staff._id,
            uid: staff.uid,
          });
        }
        // 2FA is enabled — require verification before issuing tokens
        return res.status(200).json({
          success: true,
          twoFactorRequired: true,
          message: `Welcome, ${staff.name}. Please complete the two-factor authentication step.`,
          uid: staff.uid,
        });
      }

      // No 2FA required, or it's disabled. Proceed with normal login and issue tokens.
      const { accessToken, refreshToken } = generateStaffTokens(staff);
      
      return res.json({
        success: true,
        twoFactorRequired: false,
        message: 'Login successful',
        accessToken,
        refreshToken,
        role: staff.role,
        staff: {
          _id: staff._id,
          uid: staff.uid,
          loginId: staff.loginId,
          name: staff.name,
          role: staff.role,
          permissions: staff.permissions
        }
      });
    }

    // No valid auth method provided
    return res.status(400).json({
      success: false,
      message: 'Please provide a Firebase UID or ID token.'
    });
  } catch (e) {
    Logger.error('Admin Login Error:', e);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * Verify 2FA code and issue final tokens for high-privilege users.
 */
exports.verifyTwoFactor = async (req, res) => {
    try {
        const { uid, otp } = req.body;

        if (!uid || !otp) {
            return res.status(400).json({ success: false, message: 'Staff UID and OTP are required.' });
        }

        const staff = await Staff.findOne({ uid });
        if (!staff) {
            return res.status(404).json({ success: false, message: 'Staff account not found.' });
        }

        // Here you'd verify the OTP. For Firebase phone OTP, you'd use the admin SDK.
        // For Google Authenticator, you'd use a library like 'speakeasy'.
        // Let's simulate a simple check for now. This should be replaced with a real OTP service.
        const isOtpValid = await verifyOTP(staff.phone, otp); // Assuming staff has a phone number for OTP

        if (!isOtpValid.valid) {
            return res.status(401).json({ success: false, message: 'Invalid OTP code. Please try again.' });
        }

        // OTP is valid. Issue the final access and refresh tokens.
        const { accessToken, refreshToken } = generateStaffTokens(staff);

        res.json({
            success: true,
            message: '2FA verification successful. Access granted.',
            accessToken,
            refreshToken,
            role: staff.role,
            staff: {
                _id: staff._id,
                uid: staff.uid,
                loginId: staff.loginId,
                name: staff.name,
                role: staff.role,
                permissions: staff.permissions
            }
        });

    } catch (error) {
        Logger.error('Admin 2FA Verification Error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/**
 * Refresh token endpoint
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (tokenError) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    if (!decoded.isStaff) {
      return res.status(403).json({ success: false, message: 'Invalid token payload' });
    }

    const staff = await Staff.findOne({ uid: decoded.uid });
    if (!staff || !staff.isActive) {
      return res.status(403).json({ success: false, message: 'Staff account not found or disabled' });
    }

    const tokens = generateStaffTokens(staff);

    return res.json({
      success: true,
      message: 'Token refreshed successfully',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      role: staff.role,
    });
  } catch (e) {
    Logger.error('Admin Refresh Token Error:', e);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * Helper function to generate staff tokens.
 */
const generateStaffTokens = (staff) => {
    const accessTokenPayload = {
        id: staff._id,
        uid: staff.uid,
        role: staff.role,
        isStaff: true,
        permissions: staff.permissions
    };

    const refreshTokenPayload = {
        id: staff._id,
        uid: staff.uid,
        isStaff: true
    };

    const accessToken = jwt.sign(accessTokenPayload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(refreshTokenPayload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

    return { accessToken, refreshToken };
};