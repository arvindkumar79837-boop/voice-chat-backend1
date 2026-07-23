const Logger = require('../utils/logger');
// ═══════════════════════════════════════════════════════════════════════════
// FILE: lib/arvind-party-backend/src/config/firebase-admin.js
// ARVIND PARTY - FIREBASE ADMIN SDK INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK
const initializeFirebaseAdmin = () => {
  try {
    const firebaseAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!firebaseAccount) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT is not defined in .env");
    }

    let serviceAccount;
    
    // Check if it's a JSON string
    if (firebaseAccount.trim().startsWith('{')) {
      try {
        serviceAccount = JSON.parse(firebaseAccount);
        Logger.info("✅ Firebase Admin initializing from JSON string.");
      } catch (parseError) {
        throw new Error("Failed to parse FIREBASE_SERVICE_ACCOUNT as JSON string");
      }
    } else {
      // Treat as file path
      const absolutePath = path.resolve(process.cwd(), firebaseAccount);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Service account file not found at: ${absolutePath}`);
      }
      serviceAccount = require(absolutePath);
      Logger.info("✅ Firebase Admin initializing from JSON file path.");
    }

    // Initialize Firebase Admin
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      });

      Logger.info("✅ Firebase Admin SDK initialized successfully.");
    }

    return admin;
  } catch (error) {
    Logger.error("❌ Firebase Admin initialization error:", error);
    throw error;
  }
};

// Verify Firebase ID Token
const verifyIdToken = async (token) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    Logger.error('❌ Token verification error:', error);
    throw error;
  }
};

// Create custom token for web/desktop clients
const createCustomToken = async (uid, customClaims = {}) => {
  try {
    const token = await admin.auth().createCustomToken(uid, customClaims);
    return token;
  } catch (error) {
    Logger.error('❌ Custom token creation error:', error);
    throw error;
  }
};

// Revoke refresh tokens (logout from all devices)
const revokeRefreshTokens = async (uid) => {
  try {
    await admin.auth().revokeRefreshTokens(uid);
    return true;
  } catch (error) {
    Logger.error('❌ Token revocation error:', error);
    throw error;
  }
};

// Get user by UID
const getUserById = async (uid) => {
  try {
    const user = await admin.auth().getUser(uid);
    return user;
  } catch (error) {
    Logger.error('❌ Error fetching user:', error);
    throw error;
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email) => {
  try {
    const link = await admin.auth().generatePasswordResetLink(email);
    // You would send this link via email service
    return link;
  } catch (error) {
    Logger.error('❌ Error sending password reset:', error);
    throw error;
  }
};

// Send FCM notification
const sendNotification = async (fcmToken, notification) => {
  try {
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: notification.data || {},
      token: fcmToken,
    };

    const response = await admin.messaging().send(message);
    Logger.info('✅ Notification sent:', response);
    return response;
  } catch (error) {
    Logger.error('❌ Error sending notification:', error);
    throw error;
  }
};

// Send multicast notification (to multiple devices)
const sendMulticastNotification = async (fcmTokens, notification) => {
  try {
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: notification.data || {},
    };

    const response = await admin.messaging().sendMulticast({
      ...message,
      tokens: fcmTokens,
    });

    Logger.info(`✅ Notifications sent: ${response.successCount} successful, ${response.failureCount} failed`);
    return response;
  } catch (error) {
    Logger.error('❌ Error sending multicast notification:', error);
    throw error;
  }
};

// Subscribe user to topic
const subscribeToTopic = async (fcmTokens, topic) => {
  try {
    await admin.messaging().subscribeToTopic(fcmTokens, topic);
    Logger.info(`✅ Subscribed to topic: ${topic}`);
  } catch (error) {
    Logger.error('❌ Error subscribing to topic:', error);
    throw error;
  }
};

// Unsubscribe from topic
const unsubscribeFromTopic = async (fcmTokens, topic) => {
  try {
    await admin.messaging().unsubscribeFromTopic(fcmTokens, topic);
    Logger.info(`✅ Unsubscribed from topic: ${topic}`);
  } catch (error) {
    Logger.error('❌ Error unsubscribing from topic:', error);
    throw error;
  }
};

module.exports = {
  initializeFirebaseAdmin,
  verifyIdToken,
  createCustomToken,
  revokeRefreshTokens,
  getUserById,
  sendPasswordResetEmail,
  sendNotification,
  sendMulticastNotification,
  subscribeToTopic,
  unsubscribeFromTopic,
};