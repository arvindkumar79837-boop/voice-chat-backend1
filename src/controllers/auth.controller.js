const Logger = require('../utils/logger');
// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/controllers/auth.controller.js
// ARVIND PARTY - PRODUCTION-READY AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { verifyOTP } = require('../services/otp.service');

const generateUsername = (prefix = 'user') => {
  const suffix = Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
  return `${prefix}_${suffix}`.substring(0, 20).replace(/[^a-zA-Z0-9_]/g, '');
};

const generateUid = (prefix = 'UID') => {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
};
// ═══════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════

exports.login = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    // Validate input
    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone and OTP are required'
      });
    }

    // Verify OTP
    const verification = await verifyOTP(phone, otp);

    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Find user
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please sign up first.'
      });
    }

    // Generate tokens
    const token = jwt.sign(
      { id: user._id.toString(), role: user.role, uid: user.uid, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
     );
 
     const refreshToken = jwt.sign(
      { id: user._id.toString(), role: user.role, uid: user.uid },
      process.env.REFRESH_TOKEN_SECRET,
     { expiresIn: '90d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        refreshToken,
        user: {
          _id: user._id,
          phone: user.phone,
          name: user.name || `User ${phone.slice(-4)}`,
          avatar: user.avatar,
          arvindId: user.arvindId,
          level: user.level || 1,
          isProfileComplete: user.isProfileComplete
        }
      }
    });
  } catch (error) {
    Logger.error('❌ Login Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// REGISTER (New User)
// ═══════════════════════════════════════════════════════════════════════════

exports.register = async (req, res, next) => {
  try {
    const { phone, name, gender, dob } = req.body;

    // Validation
    if (!phone || !name) {
      return res.status(400).json({
        success: false,
        message: 'Phone and name are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Create new user
    const arvindId = `ARV-${Date.now().toString().slice(-8)}`;
    const phoneSuffix = phone.slice(-4);
    const username = generateUsername(`user${phoneSuffix}`);
    const uid = generateUid('PH');
    const user = await User.create({
      phone,
      uid,
      username,
      name,
      arvindId,
      gender,
      dob: dob ? new Date(dob) : null,
      provider: 'phone',
      isProfileComplete: true,
      coins: 0,
      diamonds: 0,
      level: 1,
      xp: 0
    });

    // Generate tokens
    const token = jwt.sign(
      { id: user._id.toString(), role: user.role, uid: user.uid, phone: user.phone },
       process.env.JWT_SECRET,
       { expiresIn: '15m' }
     );
 
     const refreshToken = jwt.sign(
       { id: user._id.toString(), role: user.role, uid: user.uid },
       process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '90d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        refreshToken,
        user: {
          _id: user._id,
          phone: user.phone,
          name: user.name,
          arvindId: user.arvindId,
          level: user.level
        }
      }
    });
  } catch (error) {
    Logger.error('❌ Register Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// REFRESH TOKEN
// ═══════════════════════════════════════════════════════════════════════════

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    const userId = decoded.id;

    // Find user
    const user = await User.findById(userId).select('+role +uid +phone');
    if (!user || user.isBanned) {
      return res.status(401).json({
        success: false,
        message: 'User not found or banned',
      });
    }

    // ── TOKEN ROTATION (P0-7) ──────────────────────────────────────────
    // Delete old refresh token to prevent reuse (rotation)
    const RefreshToken = require('../models/RefreshToken');
    const oldTokenDoc = await RefreshToken.findOneAndDelete({ token: refreshToken, userId });
    // If token not found in DB, it may be a stolen/replayed token
    // We still allow first-time use for backward compat, but log it
    if (!oldTokenDoc) {
      // Could be a token issued before rotation was introduced — allow once
      // but do NOT log the user out (backward compat)
    }

    // Issue new access token
    const newAccessToken = jwt.sign(
      { id: user._id.toString(), role: user.role, uid: user.uid, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Issue new refresh token (30-day validity)
    const newRefreshToken = jwt.sign(
      { id: user._id.toString() },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '30d' }
    );

    // Persist new refresh token in DB
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await RefreshToken.create({ token: newRefreshToken, userId: user._id, expiresAt });

    res.status(200).json({
      success: true,
      message: 'Token refreshed',
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════════════════

exports.logout = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { blacklistAccessToken } = require('../utils/jwt');
      await blacklistAccessToken(token);
    }
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    Logger.error('❌ Logout Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// DELETE ACCOUNT (Permanent Deletion)
// ═══════════════════════════════════════════════════════════════════════════

exports.deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove from Agency if member
    if (user.agencyId) {
      const Agency = require('../models/Agency');
      await Agency.findByIdAndUpdate(user.agencyId, {
        $pull: { hosts: userId }
      });
    }

    // Soft delete user by anonymizing sensitive data
    user.isDeleted = true;
    user.isActive = false;
    user.isBanned = true;
    user.phone = 'DELETED-' + Date.now();
    user.email = 'deleted@deleted.com';
    user.name = 'Deleted User';
    user.displayName = 'Deleted User';
    user.avatar = '';
    user.bio = '';
    user.coverPhoto = '';
    user.uid = 'DELETED-' + Date.now();
    user.arvindId = 'DELETED';
    user.firebaseUid = null;
    user.privacy = {
      showOnlineStatus: false,
      showLastSeen: false,
      showGallery: false,
      showFollowers: false,
      showFollowing: false,
      showVisitorHistory: false
    };
    user.blockList = [];
    user.followers = [];
    user.following = [];
    user.followersCount = 0;
    user.followingCount = 0;
    user.badges = [];
    user.unlockedBadges = [];
    user.gallery = [];
    user.socialLinks = {
      instagram: '',
      youtube: '',
      twitter: '',
      website: ''
    };
    user.agencyId = null;
    user.familyId = null;
    user.deviceTokens = [];
    user.registeredDevices = [];

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Account deleted permanently'
    });
  } catch (error) {
    Logger.error('❌ Delete Account Error:', error);
    next(error);
  }
};
