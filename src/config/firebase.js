const admin = require('firebase-admin');

let isFirebaseInitialized = false;

try {
  // Require the securely downloaded service account JSON key
  const serviceAccount = require('../../firebase-service-account.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  isFirebaseInitialized = true;
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.warn('⚠️ Firebase service account not found. Firebase features disabled.');
  console.warn('   → Place firebase-service-account.json in project root to enable.');
}

module.exports = admin;
module.exports.isFirebaseInitialized = isFirebaseInitialized;