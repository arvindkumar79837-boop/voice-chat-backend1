// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/controllers/profileController.js
// ARVIND PARTY - MASTER USER PROFILE SYSTEM
// Handles profile view, update for regular users and restricted staff controls
// ═══════════════════════════════════════════════════════════════════════════

const User = require('../models/User');
const Staff = require('../models/Staff');
const Badge = require('../models/Badge');
const BannedDevice = require('../models/BannedDevice');
const path = require('path');
const fs = require('fs');

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Calculate XP needed for next level (exponential growth)
// ═══════════════════════════════════════════════════════════════════════════

function calculateXpToNextLevel(level) {
  return Math.floor(100 * Math.pow(1.15, level - 1));
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Calculate XP required for current level threshold
// ═══════════════════════════════════════════════════════════════════════════

function calculateXpForLevel(level) {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(1.15, level - 2));
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Mask phone number for privacy (show first 2 and last 4 digits)
// ═══════════════════════════════════════════════════════════════════════════

function maskPhone(phone) {
  if (!phone) return null;
  if (phone.length >= 10) {
    return phone.slice(0, 2) + '****' + phone.slice(-4);
  }
  return '****' + phone.slice(-4);
}

// ═══════════════════════════════════════════════════════════════════════════
// GET FULL PROFILE (with level, XP bar, badges, VIP info)
// GET /api/profile/:userId
// ═══════════════════════════════════════════════════════════════════════════

exports.getProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.userId;

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isOwnProfile = userId === requestingUserId;

    const staffRecord = await Staff.findOne({ userId: user._id }).lean();

    const badgeRecords = await Badge.find({
      _id: { $in: (user.unlockedBadges || []).map(id => id.toString()) }
    }).lean();

    const profileData = {
      _id: user._id,
      uid: user.uid,
      arvindId: user.arvindId,
      phone: isOwnProfile ? user.phone : maskPhone(user.phone),
      email: isOwnProfile ? user.email : null,
      name: user.name || 'User',
      displayName: user.displayName || user.name || 'User',
      username: user.username,
      avatar: user.avatar,
      bio: user.bio || '',
      gender: user.gender || 'Not specified',
      dob: user.dob || null,
      level: user.level || 1,
      xp: user.xp || 0,
      xpToNextLevel: calculateXpToNextLevel(user.level || 1),
      xpProgressPercent: Math.min(100, ((user.xp || 0) / calculateXpToNextLevel(user.level || 1)) * 100),
      coins: isOwnProfile ? (user.coins || 0) : 0,
      diamonds: isOwnProfile ? (user.diamonds || 0) : 0,
      followersCount: user.followersCount || 0,
      followingCount: user.followingCount || 0,
      role: user.role || 'user',
      vipLevel: user.vipLevel || 0,
      isVip: user.isVip || false,
      vipExpiry: user.vipExpiry || null,
      badges: badgeRecords.map(b => ({
        id: b._id,
        name: b.name,
        icon: b.icon,
        color: b.color,
        type: b.type || 'standard',
      })),
      unlockedBadges: user.unlockedBadges || [],
      activeFrame: user.activeFrame || null,
      equippedFrame: user.equippedFrame || null,
      unlockedFrames: user.unlockedFrames || [],
      isProfileComplete: user.isProfileComplete || false,
      familyId: user.familyId || null,
      familyRole: user.familyRole || null,
      familyContribution: user.familyContribution || 0,
      createdAt: user.createdAt,
      joinedDays: Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)),

      isStaff: !!staffRecord,
      staffRole: staffRecord ? staffRecord.role : null,
      staffPermissions: staffRecord ? (staffRecord.permissions || []) : [],
    };

    if (isOwnProfile) {
      profileData.totalGiftsSent = user.totalGiftsSent || 0;
      profileData.totalGiftsReceived = user.totalGiftsReceived || 0;
      profileData.suspiciousActivityCount = user.suspiciousActivityCount || 0;
      profileData.deviceFlags = user.deviceFlags || [];
    }

    res.status(200).json({
      success: true,
      data: profileData,
    });
  } catch (error) {
    console.error('❌ Get Profile Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE PROFILE
// Staff Member → Only displayName + avatar (no login credentials)
// Regular User → Full profile edit (name, avatar, bio, gender, dob, username)
// PUT /api/profile/:userId
// ═══════════════════════════════════════════════════════════════════════════

exports.updateProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.userId;
    const userRole = req.user.role;

    if (userId !== requestingUserId && !['admin', 'owner'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own profile',
        code: 'FORBIDDEN',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const staffRecord = await Staff.findOne({ userId: user._id });
    const isStaffMember = !!staffRecord;

    const allowedFields = {};

    if (isStaffMember && userId === requestingUserId) {
      // Staff can ONLY update display picture and display name
      if (req.body.displayName !== undefined) {
        allowedFields.displayName = req.body.displayName.trim();
        allowedFields.name = req.body.displayName.trim();
      }
      if (req.body.avatar !== undefined) {
        allowedFields.avatar = req.body.avatar;
      }
    } else if (userId === requestingUserId) {
      // Regular user can update full profile (except login credentials)
      if (req.body.name !== undefined) allowedFields.name = req.body.name.trim();
      if (req.body.displayName !== undefined) allowedFields.displayName = req.body.displayName.trim();
      if (req.body.avatar !== undefined) allowedFields.avatar = req.body.avatar;
      if (req.body.bio !== undefined) allowedFields.bio = req.body.bio.trim();
      if (req.body.gender !== undefined) {
        const validGenders = ['Male', 'Female', 'Other', 'Not specified'];
        if (validGenders.includes(req.body.gender)) {
          allowedFields.gender = req.body.gender;
        }
      }
      if (req.body.dob !== undefined) {
        const parsedDob = new Date(req.body.dob);
        if (!isNaN(parsedDob.getTime())) {
          allowedFields.dob = parsedDob;
        }
      }
      if (req.body.username !== undefined) {
        const username = req.body.username.trim().toLowerCase();
        if (/^[a-z0-9_]{3,20}$/.test(username)) {
          const existingUser = await User.findOne({ username, _id: { $ne: userId } });
          if (existingUser) {
            return res.status(409).json({
              success: false,
              message: 'Username is already taken',
            });
          }
          allowedFields.username = username;
        } else {
          return res.status(400).json({
            success: false,
            message: 'Username must be 3-20 characters (lowercase, numbers, underscores only)',
          });
        }
      }
    }

    if (Object.keys(allowedFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    Object.assign(user, allowedFields);
    user.isProfileComplete = true;
    user.updatedAt = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id: user._id,
        name: user.name,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio,
        gender: user.gender,
        dob: user.dob,
        username: user.username,
        isProfileComplete: user.isProfileComplete,
      },
    });
  } catch (error) {
    console.error('❌ Update Profile Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// UPLOAD PROFILE PICTURE (Avatar/DP)
// POST /api/profile/:userId/avatar
// ═══════════════════════════════════════════════════════════════════════════

exports.uploadAvatar = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.userId;

    if (userId !== requestingUserId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own avatar',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    user.avatar = avatarUrl;
    user.updatedAt = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Avatar updated successfully',
      data: {
        avatar: avatarUrl,
      },
    });
  } catch (error) {
    console.error('❌ Upload Avatar Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GET XP AND LEVEL PROGRESS (Level bar data for profile display)
// GET /api/profile/:userId/xp
// ═══════════════════════════════════════════════════════════════════════════

exports.getXpProgress = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('level xp coins diamonds');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const currentLevel = user.level || 1;
    const currentXp = user.xp || 0;
    const xpToNextLevel = calculateXpToNextLevel(currentLevel);
    const xpForCurrentLevel = calculateXpForLevel(currentLevel);

    res.status(200).json({
      success: true,
      data: {
        level: currentLevel,
        xp: currentXp,
        xpToNextLevel: xpToNextLevel,
        xpForCurrentLevel: xpForCurrentLevel,
        xpProgressPercent: Math.min(100, (currentXp / xpToNextLevel) * 100),
        coins: user.coins || 0,
        diamonds: user.diamonds || 0,
      },
    });
  } catch (error) {
    console.error('❌ Get XP Error:', error);
    next(error);
  }
};