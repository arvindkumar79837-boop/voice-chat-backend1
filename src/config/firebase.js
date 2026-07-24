/**
 * Arvind Party - Firebase Configuration
 * Re-exports from firebase-admin.js (canonical source)
 */
const { initializeFirebaseAdmin, verifyIdToken, createCustomToken, revokeRefreshTokens, getUserById, sendPasswordResetEmail, sendNotification, sendMulticastNotification, subscribeToTopic, unsubscribeFromTopic } = require('./firebase-admin');

let _admin = null;
let _isInitialized = false;

const getFirebaseAdmin = () => {
  if (!_isInitialized) {
    _admin = initializeFirebaseAdmin();
    _isInitialized = true;
  }
  return _admin;
};

const isFirebaseAvailable = () => _isInitialized;

module.exports = {
  getFirebaseAdmin,
  isFirebaseAvailable,
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
