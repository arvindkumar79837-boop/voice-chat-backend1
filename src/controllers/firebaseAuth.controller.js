// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/controllers/firebaseAuth.controller.js
// ARVIND PARTY - FIREBASE AUTH CONTROLLER (Multi-Platform Login)
// Flow: App sends Firebase ID Token → Backend verifies with Admin SDK → Returns JWT
// ═══════════════════════════════════════════════════════════════════════════

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { verifyIdToken, getUserById } = require('../config/firebase-admin');
const BannedDevice = require('../models/BannedDevice');
const { captureDeviceFingerprint } = require('../middlewares/deviceFingerprint');

// ═══════════════════════════════════════════════════════════════════════════
// VERIFY FIREBASE ID TOKEN
// POST /api/auth/firebase-verify
// Body: { idToken, deviceId, deviceInfo, platform }
// ═══════════════════════════════════════════════════════════════════════════

exports.verifyFirebaseToken = async (req, res, next) => {
  try {
    const { idToken, deviceId, deviceInfo, platform } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Firebase ID token is required',
        code: 'MISSING_TOKEN',
      });
    }

    const deviceFingerprint = captureDeviceFingerprint(req);

    if (deviceId) {
      const bannedDevice = await BannedDevice.findOne({ deviceId });
      if (bannedDevice) {
        return res.status(403).json({
          success: false,
          message: 'This device has been permanently banned from the platform.',
          code: 'DEVICE_BANNED',
          bannedReason: bannedDevice.reason,
          bannedAt: bannedDevice.bannedAt,
        });
      }
    }

    let decodedToken;
    try {
      decodedToken = await verifyIdToken(idToken);
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired Firebase ID token',
        code: 'INVALID_FIREBASE_TOKEN',
        details: tokenError.message,
      });
    }

    const firebaseUid = decodedToken.uid;
    const firebaseEmail = decodedToken.email || null;
    const firebasePhone = decodedToken.phone_number || null;

    let user = await User.findOne({
      $or: [
        { firebaseUid: firebaseUid },
        { email: firebaseEmail },
        { phone: firebasePhone?.replace('+91', '') },
      ],
    });

    const isNewUser = !user;

    if (isNewUser) {
      const arvindId = `ARV-${Date.now().toString().slice(-8)}`;
      const username = firebaseEmail
        ? firebaseEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_')
        : `user_${Date.now().toString().slice(-6)}`;

      user = await User.create({
        firebaseUid: firebaseUid,
        email: firebaseEmail,
        phone: firebasePhone?.replace('+91', '') || null,
        username: username,
        displayName: decodedToken.name || firebaseEmail?.split('@')[0] || 'User',
        name: decodedToken.name || firebaseEmail?.split('@')[0] || 'User',
        avatar: decodedToken.picture || null,
        provider: 'firebase',
        platform: platform || 'mobile',
        deviceId: deviceId || deviceFingerprint.deviceId,
        deviceInfo: deviceInfo || deviceFingerprint,
        isProfileComplete: !!(firebaseEmail || firebasePhone),
        role: 'user',
        level: 1,
        xp: 0,
        coins: 0,
        diamonds: 0,
        isActive: true,
        isBanned: false,
        lastLoginAt: new Date(),
      });
    } else {
      user.firebaseUid = firebaseUid;
      if (firebaseEmail && !user.email) user.email = firebaseEmail;
      if (firebasePhone && !user.phone) user.phone = firebasePhone.replace('+91', '');
      if (decodedToken.picture && !user.avatar) user.avatar = decodedToken.picture;
      if (decodedToken.name && !user.displayName) {
        user.displayName = decodedToken.name;
        user.name = decodedToken.name;
      }
      user.lastLoginAt = new Date();
      user.loginCount = (user.loginCount || 0) + 1;
      await user.save();
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        uid: user.uid,
        firebaseUid: user.firebaseUid,
        phone: user.phone,
        email: user.email,
        role: user.role,
        provider: 'firebase',
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' },
    );

    const refreshToken = jwt.sign(
      { userId: user._id.toString(), firebaseUid: user.firebaseUid },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '90d' },
    );

    res.status(200).json({
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      data: {
        token,
        refreshToken,
        user: {
          _id: user._id,
          uid: user.uid,
          userId: user._id.toString(),
          firebaseUid: user.firebaseUid,
          phone: user.phone,
          email: user.email,
          name: user.name,
          displayName: user.displayName,
          avatar: user.avatar,
          arvindId: user.arvindId,
          username: user.username,
          level: user.level || 1,
          xp: user.xp || 0,
          isProfileComplete: user.isProfileComplete,
          gender: user.gender,
          dob: user.dob,
          role: user.role,
          badges: user.badges || [],
          unlockedBadges: user.unlockedBadges || [],
          activeFrame: user.activeFrame,
          equippedFrame: user.equippedFrame,
          vipLevel: user.vipLevel || 0,
          isVip: user.isVip || false,
          isNewUser,
          coins: user.coins || 0,
          diamonds: user.diamonds || 0,
        },
      },
    });
  } catch (error) {
    console.error('❌ Firebase Token Verification Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// LINK FIREBASE ACCOUNT WITH EXISTING PHONE ACCOUNT
// POST /api/auth/firebase-link
// Header: Authorization: Bearer <jwt>
// Body: { idToken }
// ═══════════════════════════════════════════════════════════════════════════

exports.linkFirebaseAccount = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    const userId = req.user.userId;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Firebase ID token is required',
      });
    }

    let decodedToken;
    try {
      decodedToken = await verifyIdToken(idToken);
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Firebase ID token',
        code: 'INVALID_FIREBASE_TOKEN',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.firebaseUid && user.firebaseUid !== decodedToken.uid) {
      return res.status(409).json({
        success: false,
        message: 'This Firebase account is already linked to another user',
      });
    }

    const existingFirebaseUser = await User.findOne({ firebaseUid: decodedToken.uid });
    if (existingFirebaseUser && existingFirebaseUser._id.toString() !== userId) {
      return res.status(409).json({
        success: false,
        message: 'This Firebase account is already linked to another account',
      });
    }

    user.firebaseUid = decodedToken.uid;
    if (decodedToken.email && !user.email) user.email = decodedToken.email;
    if (decodedToken.phone_number && !user.phone) {
      user.phone = decodedToken.phone_number.replace('+91', '');
    }
    if (decodedToken.picture && !user.avatar) user.avatar = decodedToken.picture;
    if (decodedToken.name && !user.displayName) {
      user.displayName = decodedToken.name;
      user.name = decodedToken.name;
    }
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Firebase account linked successfully',
      data: {
        user: {
          _id: user._id,
          firebaseUid: user.firebaseUid,
          email: user.email,
          phone: user.phone,
          name: user.name,
          displayName: user.displayName,
          avatar: user.avatar,
        },
      },
    });
  } catch (error) {
    console.error('❌ Firebase Account Link Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// APPLE SIGN-IN SUPPORT (iOS)
// POST /api/auth/apple-verify
// Body: { identityToken, deviceId, deviceInfo, platform }
// ═══════════════════════════════════════════════════════════════════════════

exports.verifyAppleToken = async (req, res, next) => {
  try {
    const { identityToken, deviceId, deviceInfo, platform } = req.body;

    if (!identityToken) {
      return res.status(400).json({
        success: false,
        message: 'Apple identity token is required',
        code: 'MISSING_TOKEN',
      });
    }

    const deviceFingerprint = captureDeviceFingerprint(req);

    if (deviceId) {
      const bannedDevice = await BannedDevice.findOne({ deviceId });
      if (bannedDevice) {
        return res.status(403).json({
          success: false,
          message: 'This device has been permanently banned from the platform.',
          code: 'DEVICE_BANNED',
          bannedReason: bannedDevice.reason,
          bannedAt: bannedDevice.bannedAt,
        });
      }
    }

    let appleUid;
    let appleEmail = null;
    let appleName = 'Apple User';

    try {
      const appleResponse = await verifyIdToken(identityToken);
      appleUid = appleResponse.uid;
      appleEmail = appleResponse.email || null;
      appleName = appleResponse.name || appleEmail?.split('@')[0] || 'Apple User';
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Apple identity token',
        code: 'INVALID_APPLE_TOKEN',
      });
    }

    let user = await User.findOne({ firebaseUid: appleUid });

    const isNewUser = !user;
    if (isNewUser) {
      const arvindId = `ARV-${Date.now().toString().slice(-8)}`;
      const username = `apple_${Date.now().toString().slice(-6)}`;

      user = await User.create({
        firebaseUid: appleUid,
        email: appleEmail,
        username: username,
        displayName: appleName,
        name: appleName,
        avatar: null,
        provider: 'apple',
        platform: platform || 'ios',
        deviceId: deviceId || deviceFingerprint.deviceId,
        deviceInfo: deviceInfo || deviceFingerprint,
        isProfileComplete: !!appleEmail,
        role: 'user',
        level: 1,
        xp: 0,
        coins: 0,
        diamonds: 0,
        isActive: true,
        isBanned: false,
        lastLoginAt: new Date(),
      });
    } else {
      user.lastLoginAt = new Date();
      user.loginCount = (user.loginCount || 0) + 1;
      await user.save();
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        uid: user.uid,
        firebaseUid: user.firebaseUid,
        phone: user.phone,
        email: user.email,
        role: user.role,
        provider: 'apple',
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' },
    );

    const refreshToken = jwt.sign(
      { userId: user._id.toString(), firebaseUid: user.firebaseUid },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '90d' },
    );

    res.status(200).json({
      success: true,
      message: isNewUser ? 'Apple account created successfully' : 'Apple login successful',
      data: {
        token,
        refreshToken,
        user: {
          _id: user._id,
          uid: user.uid,
          userId: user._id.toString(),
          firebaseUid: user.firebaseUid,
          phone: user.phone,
          email: user.email,
          name: user.name,
          displayName: user.displayName,
          avatar: user.avatar,
          arvindId: user.arvindId,
          username: user.username,
          level: user.level || 1,
          xp: user.xp || 0,
          isProfileComplete: user.isProfileComplete,
          gender: user.gender,
          dob: user.dob,
          role: user.role,
          badges: user.badges || [],
          unlockedBadges: user.unlockedBadges || [],
          activeFrame: user.activeFrame,
          equippedFrame: user.equippedFrame,
          vipLevel: user.vipLevel || 0,
          isVip: user.isVip || false,
          isNewUser,
          coins: user.coins || 0,
          diamonds: user.diamonds || 0,
        },
      },
    });
  } catch (error) {
    console.error('❌ Apple Token Verification Error:', error);
    next(error);
  }
};