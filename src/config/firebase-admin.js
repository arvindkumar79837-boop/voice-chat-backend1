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
    const credentialPath = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!credentialPath) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT path is not defined in .env");
    }

    // Resolve absolute path from root
    const absolutePath = path.resolve(process.cwd(), credentialPath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Service account file not found at: ${absolutePath}`);
    }

    const serviceAccount = require(absolutePath);

    // Initialize Firebase Admin
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      });

      console.log("✅ Firebase Admin SDK initialized successfully using JSON file path.");
    }

    return admin;
  } catch (error) {
    console.error("❌ Firebase Admin initialization error:", error);
    throw error;
  }
};

// Verify Firebase ID Token
const verifyIdToken = async (token) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('❌ Token verification error:', error);
    throw error;
  }
};

// Create custom token for web/desktop clients
const createCustomToken = async (uid, customClaims = {}) => {
  try {
    const token = await admin.auth().createCustomToken(uid, customClaims);
    return token;
  } catch (error) {
    console.error('❌ Custom token creation error:', error);
    throw error;
  }
};

// Revoke refresh tokens (logout from all devices)
const revokeRefreshTokens = async (uid) => {
  try {
    await admin.auth().revokeRefreshTokens(uid);
    return true;
  } catch (error) {
    console.error('❌ Token revocation error:', error);
    throw error;
  }
};

// Get user by UID
const getUserById = async (uid) => {
  try {
    const user = await admin.auth().getUser(uid);
    return user;
  } catch (error) {
    console.error('❌ Error fetching user:', error);
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
    console.error('❌ Error sending password reset:', error);
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
    console.log('✅ Notification sent:', response);
    return response;
  } catch (error) {
    console.error('❌ Error sending notification:', error);
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

    console.log(`✅ Notifications sent: ${response.successCount} successful, ${response.failureCount} failed`);
    return response;
  } catch (error) {
    console.error('❌ Error sending multicast notification:', error);
    throw error;
  }
};

// Subscribe user to topic
const subscribeToTopic = async (fcmTokens, topic) => {
  try {
    await admin.messaging().subscribeToTopic(fcmTokens, topic);
    console.log(`✅ Subscribed to topic: ${topic}`);
  } catch (error) {
    console.error('❌ Error subscribing to topic:', error);
    throw error;
  }
};

// Unsubscribe from topic
const unsubscribeFromTopic = async (fcmTokens, topic) => {
  try {
    await admin.messaging().unsubscribeFromTopic(fcmTokens, topic);
    console.log(`✅ Unsubscribed from topic: ${topic}`);
  } catch (error) {
    console.error('❌ Error unsubscribing from topic:', error);
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