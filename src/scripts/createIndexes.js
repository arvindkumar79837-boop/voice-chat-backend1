// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/scripts/createIndexes.js
// ARVIND PARTY - DATABASE INDEX MIGRATION SCRIPT
// Run: node src/scripts/createIndexes.js
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');
const Logger = require('../utils/logger');

const createIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    Logger.info('Connected to MongoDB. Creating indexes...');

    const db = mongoose.connection.db;

    // ─── USER COLLECTION INDEXES ─────────────────────────────────────────
    Logger.info('Creating User indexes...');
    await db.collection('users').createIndex({ uid: 1 }, { unique: true });
    await db.collection('users').createIndex({ phone: 1 }, { unique: true, sparse: true });
    await db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true });
    await db.collection('users').createIndex({ agencyId: 1 });
    await db.collection('users').createIndex({ familyId: 1 });
    await db.collection('users').createIndex({ isActive: 1, isBanned: 1 });
    await db.collection('users').createIndex({ createdAt: -1 });

    // ─── ROOM COLLECTION INDEXES ─────────────────────────────────────────
    Logger.info('Creating Room indexes...');
    await db.collection('rooms').createIndex({ roomId: 1 }, { unique: true });
    await db.collection('rooms').createIndex({ ownerId: 1 });
    await db.collection('rooms').createIndex({ isActive: 1, status: 1 });
    await db.collection('rooms').createIndex({ activeUsers: -1 });
    await db.collection('rooms').createIndex({ createdAt: -1 });

    // ─── GIFT COLLECTION INDEXES ─────────────────────────────────────────
    Logger.info('Creating Gift indexes...');
    await db.collection('gifts').createIndex({ category: 1, isAvailable: 1 });
    await db.collection('gifts').createIndex({ price: 1 });
    await db.collection('gifts').createIndex({ isAvailable: 1 });

    // ─── GIFT TRANSACTION COLLECTION INDEXES ─────────────────────────────
    Logger.info('Creating GiftTransaction indexes...');
    await db.collection('gifttransactions').createIndex({ senderId: 1, createdAt: -1 });
    await db.collection('gifttransactions').createIndex({ receiverId: 1, createdAt: -1 });
    await db.collection('gifttransactions').createIndex({ roomId: 1, createdAt: -1 });
    await db.collection('gifttransactions').createIndex({ transactionId: 1 }, { unique: true, sparse: true });

    // ─── WALLET TRANSACTION COLLECTION INDEXES ───────────────────────────
    Logger.info('Creating WalletTransaction indexes...');
    await db.collection('wallettransactions').createIndex({ userId: 1, createdAt: -1 });
    await db.collection('wallettransactions').createIndex({ userId: 1, walletType: 1 });
    await db.collection('wallettransactions').createIndex({ type: 1, createdAt: -1 });

    // ─── NOTIFICATION COLLECTION INDEXES ─────────────────────────────────
    Logger.info('Creating Notification indexes...');
    await db.collection('notifications').createIndex({ userId: 1, createdAt: -1 });
    await db.collection('notifications').createIndex({ userId: 1, isRead: 1 });

    // ─── ATTENDANCE COLLECTION INDEXES ───────────────────────────────────
    Logger.info('Creating Attendance indexes...');
    await db.collection('attendances').createIndex({ userId: 1, date: -1 }, { unique: true });

    // ─── REFRESH TOKEN COLLECTION INDEXES ────────────────────────────────
    Logger.info('Creating RefreshToken indexes...');
    await db.collection('refreshtokens').createIndex({ userId: 1, token: 1 }, { unique: true });
    await db.collection('refreshtokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    // ─── MESSAGE COLLECTION INDEXES ──────────────────────────────────────
    Logger.info('Creating Message indexes...');
    await db.collection('roommessages').createIndex({ roomId: 1, createdAt: -1 });
    await db.collection('roommessages').createIndex({ senderId: 1, createdAt: -1 });

    // ─── AGENCY COLLECTION INDEXES ───────────────────────────────────────
    Logger.info('Creating Agency indexes...');
    await db.collection('agencies').createIndex({ owner: 1 }, { unique: true });
    await db.collection('agencies').createIndex({ isApproved: 1 });
    await db.collection('agencies').createIndex({ createdAt: -1 });

    // ─── FAMILY COLLECTION INDEXES ───────────────────────────────────────
    Logger.info('Creating Family indexes...');
    await db.collection('families').createIndex({ familyId: 1 }, { unique: true });
    await db.collection('families').createIndex({ ownerId: 1 });
    await db.collection('families').createIndex({ is_active: 1, is_banned: 1 });

    // ─── ANALYTICS COLLECTION INDEXES ────────────────────────────────────
    Logger.info('Creating Analytics indexes...');
    await db.collection('useractivities').createIndex({ userId: 1, date: -1 });
    await db.collection('giftanalytics').createIndex({ giftId: 1, date: -1 });
    await db.collection('agencyanalytics').createIndex({ agencyId: 1, date: -1 });
    await db.collection('familyanalytics').createIndex({ familyId: 1, date: -1 });

    // ─── FAMILY STAY REWARD COLLECTION INDEXES ───────────────────────────
    Logger.info('Creating FamilyStayReward indexes...');
    await db.collection('familystayrewards').createIndex({ uid: 1, date: -1 }, { unique: true });
    await db.collection('familystayrewards').createIndex({ familyId: 1, isActive: 1 });

    // ─── DEVICE SESSION COLLECTION INDEXES ───────────────────────────────
    Logger.info('Creating DeviceSession indexes...');
    await db.collection('devicesessions').createIndex({ userId: 1, isActive: 1 });
    await db.collection('devicesessions').createIndex({ sessionToken: 1 }, { unique: true, sparse: true });
    await db.collection('devicesessions').createIndex({ sessionExpiresAt: 1 }, { expireAfterSeconds: 0 });

    Logger.info('✅ All indexes created successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    Logger.error('❌ Index creation failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

createIndexes();