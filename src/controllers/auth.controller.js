// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/controllers/auth.controller.js
// ARVIND PARTY - PRODUCTION-READY AUTHENTICATION
// Flow: Phone → OTP Service → Backend → JWT Token → Mobile App
// ═══════════════════════════════════════════════════════════════════════════

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendOTP, verifyOTP } = require('../services/otp.service');

// ═══════════════════════════════════════════════════════════════════════════
// SEND OTP
// ═══════════════════════════════════════════════════════════════════════════

exports.sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;

    // Validation
    if (!phone || !/^[0-9]{10}$/.test(phone.replace(/\D/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Expected 10 digits.'
      });
    }

    // Send OTP using OTP service
    const result = await sendOTP(phone);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to send OTP'
      });
    }

    // In development mode, return OTP for testing
    const responseData = {
      success: true,
      message: 'OTP sent successfully',
      phone: phone
    };

    if (process.env.NODE_ENV === 'development') {
      responseData.debugOtp = result.otp; // Only in dev - remove in production
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error('❌ Send OTP Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// VERIFY OTP
// ═══════════════════════════════════════════════════════════════════════════

exports.verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    // Validation
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    if (!otp || !/^\d{4,6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP format'
      });
    }

    // Verify OTP using OTP service
    const verification = await verifyOTP(phone, otp);

    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        message: verification.message || 'Invalid OTP'
      });
    }

    // Find or create user
    let user = await User.findOne({ phone });
    const isNewUser = !user;

    if (isNewUser) {
      // Create new user
      const arvindId = `ARV-${Date.now().toString().slice(-8)}`;
      user = await User.create({
        phone,
        arvindId,
        provider: 'phone',
        isProfileComplete: false,
        coins: 0,
        diamonds: 0,
        level: 1,
        xp: 0
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        phone: user.phone,
        provider: user.provider
      },
       process.env.JWT_SECRET,
       { expiresIn: '30d' }
     );
 
     // Generate refresh token
     const refreshToken = jwt.sign(
       { userId: user._id.toString() },
       process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '90d' }
    );

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        token,
        refreshToken,
        user: {
          _id: user._id,
          userId: user._id.toString(),
          phone: user.phone,
          name: user.name || `User ${phone.slice(-4)}`,
          avatar: user.avatar || null,
          arvindId: user.arvindId,
          level: user.level || 1,
          isProfileComplete: user.isProfileComplete,
          isNewUser
        }
      }
    });
  } catch (error) {
    console.error('❌ Verify OTP Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN (Alternative - if user already exists)
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
      { userId: user._id.toString(), phone: user.phone },
       process.env.JWT_SECRET,
       { expiresIn: '30d' }
     );
 
     const refreshToken = jwt.sign(
       { userId: user._id.toString() },
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
    console.error('❌ Login Error:', error);
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
    const user = await User.create({
      phone,
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
      { userId: user._id.toString(), phone: user.phone },
       process.env.JWT_SECRET,
       { expiresIn: '30d' }
     );
 
     const refreshToken = jwt.sign(
       { userId: user._id.toString() },
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
    console.error('❌ Register Error:', error);
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
        message: 'Refresh token is required'
      });
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      const userId = decoded.userId;

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Generate new token
      const newToken = jwt.sign(
        { userId: user._id.toString(), phone: user.phone },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.status(200).json({
        success: true,
        message: 'Token refreshed',
        data: {
          token: newToken
        }
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }
  } catch (error) {
    console.error('❌ Refresh Token Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════════════════

exports.logout = async (req, res, next) => {
  try {
    // In a real app, you might blacklist the token here
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('❌ Logout Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// RESEND OTP
// ═══════════════════════════════════════════════════════════════════════════

exports.resendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const result = await sendOTP(phone);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to resend OTP'
      });
    }

    res.status(200).json({
      success: true,
      message: 'OTP resent successfully'
    });
  } catch (error) {
    console.error('❌ Resend OTP Error:', error);
    next(error);
  }
};
