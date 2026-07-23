/**
 * Arvind Party - Firebase Configuration
 * Re-exports from firebase-admin.js (canonical source)
 */
const { getFirebaseAdmin, isFirebaseAvailable } = require('./firebase-admin');

module.exports = getFirebaseAdmin();
module.exports.isFirebaseInitialized = isFirebaseAvailable();
