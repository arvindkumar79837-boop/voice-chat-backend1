const Logger = require('../utils/logger');
// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/services/otp.service.js
// ARVIND PARTY - OTP SERVICE (REDIS/MEMORY FALLBACK)
// Firebase Phone Auth is the primary auth method.
// ═══════════════════════════════════════════════════════════════════════════

const { getRedisClient } = require('../config/redis');

let isRedisConnected = false;

const initRedis = async () => {
  const client = getRedisClient();
  isRedisConnected = client !== null && client.isOpen;
  if (isRedisConnected) {
    Logger.info('✅ OTP service using shared Redis client');
  } else {
    Logger.info('⚠️ Shared Redis not available, OTP will use in-memory storage');
  }
};

// In-memory fallback (if Redis not available)
const otpMemoryStore = new Map();

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

// Store OTP
const storeOTP = async (phone, otp, expiryMinutes = 5) => {
  try {
    const client = getRedisClient();
    if (client && client.isOpen) {
      isRedisConnected = true;
      const key = `otp:${phone}`;
      const expirySeconds = expiryMinutes * 60;
      await client.setEx(key, expirySeconds, otp);
      Logger.info(`✅ OTP stored in Redis for ${phone}`);
    } else {
      // Fallback to memory
      otpMemoryStore.set(phone, {
        otp,
        expiresAt: Date.now() + expiryMinutes * 60 * 1000
      });
      Logger.info(`⚠️ OTP stored in memory for ${phone}`);
    }
    return true;
  } catch (error) {
    Logger.error('❌ Failed to store OTP:', error.message);
    return false;
  }
};

// Verify OTP
const verifyOTP = async (phone, otp) => {
  try {
    let storedOtp = null;

    const client = getRedisClient();
    if (client && client.isOpen) {
      isRedisConnected = true;
      const key = `otp:${phone}`;
      storedOtp = await client.get(key);
    } else {
      // Fallback to memory
      const entry = otpMemoryStore.get(phone);
      if (entry && entry.expiresAt > Date.now()) {
        storedOtp = entry.otp;
      }
    }

    if (!storedOtp) {
      return { valid: false, message: 'OTP expired or not found' };
    }

    if (storedOtp !== otp) {
      return { valid: false, message: 'Invalid OTP' };
    }

    // Delete OTP after successful verification
    const client = getRedisClient();
    if (client && client.isOpen) {
      await client.del(`otp:${phone}`);
    } else {
      otpMemoryStore.delete(phone);
    }

    return { valid: true, message: 'OTP verified successfully' };
  } catch (error) {
    Logger.error('❌ OTP verification failed:', error.message);
    return { valid: false, message: 'Verification error' };
  }
};

// Send OTP (main function)
const sendOTP = async (phone) => {
  try {
    if (!phone || !/^[0-9]{10}$/.test(phone)) {
      return { success: false, message: 'Invalid phone number' };
    }

    const otp = generateOTP();

    const stored = await storeOTP(phone, otp);
    if (!stored) {
      return { success: false, message: 'Failed to generate OTP' };
    }

    return {
      success: true,
      message: 'OTP sent successfully',
      ...(process.env.NODE_ENV === 'development' && { otp })
    };
  } catch (error) {
    Logger.error('❌ Error in sendOTP:', error);
    return { success: false, message: 'Failed to send OTP' };
  }
};

// Resend OTP
const resendOTP = async (phone) => {
  return sendOTP(phone);
};

module.exports = {
  initRedis,
  sendOTP,
  verifyOTP,
  resendOTP,
  generateOTP
};
