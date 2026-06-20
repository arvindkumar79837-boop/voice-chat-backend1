const redis = require('redis');
const twilio = require('twilio');

// Redis Client for OTP Storage
let redisClient = null;
let isRedisConnected = false;

const initRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
    
    redisClient = redis.createClient({
      url: redisUrl,
      password: process.env.REDIS_PASSWORD || undefined,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            console.warn('⚠️ Redis: Max reconnection attempts reached');
            return new Error('Max reconnection attempts');
          }
          return Math.min(retries * 200, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis Error:', err.message);
      isRedisConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis Connected');
      isRedisConnected = true;
    });

    redisClient.on('ready', () => {
      isRedisConnected = true;
    });

    redisClient.on('end', () => {
      isRedisConnected = false;
    });

    await redisClient.connect();
  } catch (error) {
    console.warn('⚠️ Redis connection failed, using in-memory storage:', error.message);
    isRedisConnected = false;
  }
};

// In-memory fallback (if Redis not available)
const otpMemoryStore = new Map();

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

// Send OTP via Twilio SMS
const sendOTPViaSMS = async (phone, otp) => {
  try {
    if (process.env.TWILIO_ENABLED !== 'true' || !process.env.TWILIO_ACCOUNT_SID) {
      console.log(`[DEV MODE] OTP for ${phone}: ${otp}`);
      return true;
    }

    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const message = await twilioClient.messages.create({
      body: `Your Arvind Party OTP is: ${otp}. Valid for 5 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${phone}` // India country code
    });

    console.log(`✅ SMS sent to ${phone}: ${message.sid}`);
    return true;
  } catch (error) {
    console.error('❌ SMS send failed:', error.message);
    return false;
  }
};

// Store OTP
const storeOTP = async (phone, otp, expiryMinutes = 5) => {
  try {
    if (isRedisConnected && redisClient) {
      const key = `otp:${phone}`;
      const expirySeconds = expiryMinutes * 60;
      await redisClient.setex(key, expirySeconds, otp);
      console.log(`✅ OTP stored in Redis for ${phone}`);
    } else {
      // Fallback to memory
      otpMemoryStore.set(phone, {
        otp,
        expiresAt: Date.now() + expiryMinutes * 60 * 1000
      });
      console.log(`⚠️ OTP stored in memory for ${phone}`);
    }
    return true;
  } catch (error) {
    console.error('❌ Failed to store OTP:', error.message);
    return false;
  }
};

// Verify OTP
const verifyOTP = async (phone, otp) => {
  try {
    let storedOtp = null;

    if (isRedisConnected && redisClient) {
      const key = `otp:${phone}`;
      storedOtp = await redisClient.get(key);
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
    if (isRedisConnected && redisClient) {
      await redisClient.del(`otp:${phone}`);
    } else {
      otpMemoryStore.delete(phone);
    }

    return { valid: true, message: 'OTP verified successfully' };
  } catch (error) {
    console.error('❌ OTP verification failed:', error.message);
    return { valid: false, message: 'Verification error' };
  }
};

// Send OTP (main function)
const sendOTP = async (phone) => {
  try {
    // Validate phone
    if (!phone || !/^[0-9]{10}$/.test(phone)) {
      return { success: false, message: 'Invalid phone number' };
    }

    const otp = generateOTP();

    // Store OTP
    const stored = await storeOTP(phone, otp);
    if (!stored) {
      return { success: false, message: 'Failed to generate OTP' };
    }

    // Send OTP
    const sent = await sendOTPViaSMS(phone, otp);

    return {
      success: true,
      message: 'OTP sent successfully',
      ...(process.env.NODE_ENV === 'development' && { otp }) // Show OTP in dev
    };
  } catch (error) {
    console.error('❌ Error in sendOTP:', error);
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
