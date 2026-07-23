const Logger = require('../utils/logger');
// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/services/fraudDetection.service.js
// ARVIND PARTY — Financial Fraud Protection Engine [Phase 34]
// • Google Play Store Server-to-Server verification
// • Abnormal coin transfer detection & auto-hold
// • Rapid gifting / multi-wallet drain analysis
// ═══════════════════════════════════════════════════════════════════════════

const axios = require('axios');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const WalletTransaction = require('../models/WalletTransaction');
const FraudAlert = require('../models/FraudAlert');
const AuditLog = require('../models/AuditLog');
const Recharge = require('../models/Recharge');
const RechargePlan = require('../models/RechargePlan');

// ── Configurable thresholds ────────────────────────────────────────────────
const MAX_COIN_TRANSFER_PER_MINUTE = 50000; // coins
const MAX_GIFT_VALUE_PER_HOUR = 100000;
const MIN_TRANSFER_INTERVAL_MS = 1000; // min 1s between transfers (anti-bot)
const GOOGLE_PLAY_PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.arvindparty.app';
const GOOGLE_PLAY_SERVICE_ACCOUNT = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT || null;

/**
 * Verify a Google Play Store purchase / subscription token server-to-server.
 * POST body includes purchaseToken for the specific product (e.g., coin pack).
 */
const verifyGooglePlayPurchase = async ({ packageName, productId, purchaseToken }) => {
  if (!GOOGLE_PLAY_SERVICE_ACCOUNT) {
    // In development without service account, simulate success for active RechargePlan products
    try {
      const plans = await RechargePlan.find({ isActive: true }).select('googlePlayProductId').lean();
      const devAllowed = plans.map(p => p.googlePlayProductId).filter(Boolean);
      if (devAllowed.includes(productId)) {
        return { valid: true, consumed: false, purchaseTime: Date.now() };
      }
    } catch (_) {
      // Fallback if DB query fails
    }
    return { valid: false, reason: 'Google Play verification skipped in dev mode for unknown product.' };
  }

  try {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client();
    // Service account credentials are expected in env var as JSON string
    const credentials = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '{}');
    await client.setCredentials(credentials);
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName || GOOGLE_PLAY_PACKAGE_NAME}/purchases/products/${productId}/tokens/${purchaseToken}`;
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${(await client.getAccessToken()).token}` } });
    const data = res.data;
    if (data.purchaseState !== 0) {
      return { valid: false, reason: `Purchase state is ${data.purchaseState}` };
    }
    return { valid: true, consumed: data.consumptionState === 1, purchaseTime: data.purchaseTimeMillis };
  } catch (err) {
    Logger.error('Google Play verification failed:', err.response?.data || err.message);
    return { valid: false, reason: err.response?.data?.error?.message || err.message };
  }
};

/**
 * Verify a Google Play subscription token server-to-server.
 * Uses purchases.subscriptions endpoint (different from one-time products).
 */
const verifyGooglePlaySubscription = async ({ packageName, productId, purchaseToken }) => {
  if (!GOOGLE_PLAY_SERVICE_ACCOUNT) {
    // Dev mode: trust subscription tokens for any product (no real verification possible)
    return { valid: true, expiryTimeMillis: Date.now() + 30 * 86400000, paymentState: 0, isTrial: false };
  }

  try {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client();
    const credentials = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '{}');
    await client.setCredentials(credentials);
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName || GOOGLE_PLAY_PACKAGE_NAME}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${(await client.getAccessToken()).token}` } });
    const data = res.data;
    // paymentState: 0=payment pending, 1=payment received, 2=free trial, 3=pending deferred upgrade/downgrade
    if (data.paymentState !== 1 && data.paymentState !== 2) {
      return { valid: false, reason: `Subscription payment state is ${data.paymentState} (not paid)` };
    }
    // Check expiry
    const expiryMillis = parseInt(data.expiryTimeMillis);
    if (expiryMillis && expiryMillis < Date.now()) {
      return { valid: false, reason: 'Subscription has expired on Google Play' };
    }
    return {
      valid: true,
      expiryTimeMillis: expiryMillis,
      paymentState: data.paymentState,
      isTrial: data.paymentState === 2,
      startTimeMillis: data.startTimeMillis,
      cancelReason: data.cancelReason || null,
    };
  } catch (err) {
    Logger.error('Google Play subscription verification failed:', err.response?.data || err.message);
    return { valid: false, reason: err.response?.data?.error?.message || err.message };
  }
};

/**
 * Evaluate wallet/coin activity for anomaly patterns.
 * Called AFTER a successful recharge or gift event.
 */
const evaluateFinancialActivity = async ({ userId, uid, actionType, amountInCoins, metadata = {} }) => {
  if (actionType === 'RECHARGE') {
    // Already verified server-to-server by controller — just log
    await AuditLog.create({
      action: 'RECHARGE_SUCCESS',
      executorId: userId,
      executorUid: uid,
      reason: `Recharge verified: ${amountInCoins} coins`,
      metadata: { packageName: metadata.packageName, productId: metadata.productId }
    });
    return { flagged: false };
  }

  // For gifts/transfers, check rapid pattern
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const recentGifts = await WalletTransaction.find({
    userId,
    type: 'gift_sent',
    createdAt: { $gte: oneMinuteAgo },
  });

  const totalCoinsLastMinute = recentGifts.reduce((sum, t) => sum + (t.amount || 0), 0);

  if (totalCoinsLastMinute > MAX_COIN_TRANSFER_PER_MINUTE) {
    await _createFraudAlert(userId, uid, 'ABNORMAL_COIN_TRANSFER', `Transferred ${totalCoinsLastMinute} coins in under 1 minute.`, 'CRITICAL', amountInCoins, metadata);
    await _holdAccount(userId, 'Abnormal transfer pattern detected.');
    return { flagged: true, reason: 'ABNORMAL_TRANSFER_RATE' };
  }

  // Anti multi-wallet drain: check if receiving wallet has unusual inflow
  if (actionType === 'gift_sent') {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const receivedLastHour = await WalletTransaction.find({
      userId,
      type: 'gift_received',
      createdAt: { $gte: hourAgo },
    });
    const totalReceived = receivedLastHour.reduce((sum, t) => sum + (t.amount || 0), 0);
    if (totalReceived > MAX_GIFT_VALUE_PER_HOUR) {
      await _createFraudAlert(userId, uid, 'MULTI_WALLET_DRAIN', `Received ${totalReceived} coins via gifts in 1 hour.`, 'HIGH', amountInCoins, metadata);
    }
  }

  return { flagged: false };
};

/**
 * Evaluate Google Play fake receipt attempts.
 * Returns true if verification passed.
 */
const verifyAndEvaluateRecharge = async ({ userId, uid, productId, purchaseToken, amountInCoins }) => {
  const verification = await verifyGooglePlayPurchase({
    packageName: GOOGLE_PLAY_PACKAGE_NAME,
    productId,
    purchaseToken,
  });

  if (!verification.valid) {
    await _createFraudAlert(userId, uid, 'FAKE_RECHARGE', `Invalid Google Play receipt for ${productId}.`, 'CRITICAL', amountInCoins, { productId, purchaseToken });
    await AuditLog.create({
      action: 'INVALID_PAYMENT_CLAIM',
      executorId: userId,
      executorUid: uid,
      reason: `Fake recharge attempt: ${productId}`,
      metadata: { purchaseToken, productId }
    });
    return { success: false, reason: verification.reason };
  }

  // Also guard against duplicate purchase tokens
  const existing = await Recharge.findOne({ purchaseToken, productId, status: 'success' });
  if (existing) {
    await _createFraudAlert(userId, uid, 'PLAY_STORE_FAKE_RECEIPT', `Duplicate purchaseToken detected for ${productId}.`, 'HIGH', amountInCoins, { purchaseToken });
    return { success: false, reason: 'Duplicate purchase token.' };
  }

  return { success: true, purchaseTime: verification.purchaseTime };
};

// ── Private helpers ────────────────────────────────────────────────────────

const _createFraudAlert = async (userId, uid, type, description, severity, amountInvolved = 0, metadata = {}) => {
  try {
    const alert = await FraudAlert.create({
      userId,
      uid,
      type,
      description,
      severity,
      amountInvolved: amountInvolved || 0,
      ipAddress: null,
      deviceId: null,
      metadata,
    });

    // Notify finance manager (email/in-app) — leaving as push hook
    await AuditLog.create({
      action: 'SUSPICIOUS_ACTIVITY',
      executorId: userId,
      executorUid: uid,
      reason: `Fraud alert created: ${type}`,
      metadata: { alertId: alert._id.toString() }
    });

    return alert;
  } catch (_) {
    return null;
  }
};

const _holdAccount = async (userId, reason) => {
  try {
    await User.findByIdAndUpdate(userId, {
      $set: { isBlocked: true, isCoinSeller: false },
    });
    await _createFraudAlert(userId, '', 'ABNORMAL_COIN_TRANSFER', reason, 'CRITICAL', 0);
  } catch (_) {}
};

// ── Device fingerprint + IP pattern (anti referral farming) ─────────────────

const MAX_REFERRALS_PER_IP = 5;
const MAX_REFERRALS_PER_DEVICE = 3;

/**
 * Check if IP or device fingerprint has excessive referral registrations.
 * Call during referral bonus claim.
 */
const checkReferralFraud = async ({ userId, uid, ip, deviceFingerprint }) => {
  const alerts = [];

  if (ip) {
    const ipCount = await User.countDocuments({ lastLoginIp: ip, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    if (ipCount > MAX_REFERRALS_PER_IP) {
      alerts.push({ type: 'REFERRAL_FARM_IP', description: `${ipCount} accounts from same IP in 24h`, severity: 'HIGH' });
    }
  }

  if (deviceFingerprint) {
    const deviceCount = await User.countDocuments({
      'registeredDevices.fingerprint': deviceFingerprint,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    if (deviceCount > MAX_REFERRALS_PER_DEVICE) {
      alerts.push({ type: 'REFERRAL_FARM_DEVICE', description: `${deviceCount} accounts from same device in 24h`, severity: 'HIGH' });
    }
  }

  for (const a of alerts) {
    await _createFraudAlert(userId, uid, a.type, a.description, a.severity, 0, { ip, deviceFingerprint });
  }

  return { flagged: alerts.length > 0, alerts };
};

module.exports = {
  verifyGooglePlayPurchase,
  verifyGooglePlaySubscription,
  evaluateFinancialActivity,
  verifyAndEvaluateRecharge,
  checkReferralFraud,
};