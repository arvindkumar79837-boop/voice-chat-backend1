// ═══════════════════════════════════════════════════════════════════════════
// CONTROLLER: GoogleAuthController — Google OAuth login
// ═══════════════════════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Staff = require('../models/Staff');

/**
 * POST /api/auth/google
 * Google OAuth login — accepts Firebase ID token from mobile/web
 */
exports.googleLogin = async (req, res) => {
  try {
    const { idToken, firebaseUid } = req.body;

    if (!idToken && !firebaseUid) {
      return res.status(400).json({ success: false, message: 'ID token or Firebase UID required' });
    }

    let user;
    let isNewUser = false;

    // Find user by Firebase UID
    user = await User.findOne({ uid: firebaseUid });

    if (!user) {
      // Create new user if not exists
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      user = new User({
        uid: firebaseUid,
        name: `User_${randomSuffix}`,
        phone: '',
        email: '',
        isVerified: true,
        coins: 0,
        diamonds: 0,
        level: 1,
        role: 'user',
      });
      await user.save();
      isNewUser = true;
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, uid: user.uid, role: user.role, isUser: true },
      process.env.JWT_SECRET || 'arvind_party_super_secret_key',
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        uid: user.uid,
        name: user.name,
        phone: user.phone,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        coins: user.coins,
        diamonds: user.diamonds,
        level: user.level,
        isVerified: user.isVerified,
        isNewUser,
      },
    });
  } catch (error) {
    console.error('Google Login Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/auth/apple
 * Apple Sign-in — accepts Apple identity token
 */
exports.appleLogin = async (req, res) => {
  try {
    const { identityToken, firebaseUid, email, name } = req.body;

    if (!identityToken && !firebaseUid) {
      return res.status(400).json({ success: false, message: 'Identity token or Firebase UID required' });
    }

    let user = await User.findOne({ uid: firebaseUid });

    if (!user) {
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      user = new User({
        uid: firebaseUid,
        name: name || `Apple_${randomSuffix}`,
        phone: '',
        email: email || '',
        isVerified: true,
        coins: 0,
        diamonds: 0,
        level: 1,
        role: 'user',
      });
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, uid: user.uid, role: user.role, isUser: true },
      process.env.JWT_SECRET || 'arvind_party_super_secret_key',
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        uid: user.uid,
        name: user.name,
        phone: user.phone,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        coins: user.coins,
        diamonds: user.diamonds,
        level: user.level,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error('Apple Login Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};