// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/services/anti.spam.service.js
// ARVIND PARTY — Anti-Spam & Anti-Abuse Engine [Phase 33]
// • Repeated message detection
// • Profanity filter (configurable word list)
// • Rapid-fire message rate check
// • Game anti-cheat timing validator
// ═══════════════════════════════════════════════════════════════════════════

const SpamLog  = require('../models/SpamLog');
const User     = require('../models/User');
const AuditLog = require('../models/AuditLog');

// ── Profanity word list (seed list; extend via DB in production) ──────────
const PROFANITY_LIST = [
  'abuse1', 'abuse2', 'slur1', 'slur2',
  // INSERT YOUR PROFANITY WORDS HERE — one per entry, lowercase
];

// ── Per-user in-memory message tracking (resets on server restart) ────────
// For production: use Redis with per-user sliding window counters.
const userMessageWindows = new Map(); // userId -> [timestamp, ...]
const userLastMessages   = new Map(); // userId -> lastMessage string

const MAX_MESSAGES_PER_10S = 8;  // Max 8 messages in 10 seconds before throttle
const REPEAT_THRESHOLD     = 3;  // Same message 3 times = spam

/**
 * Analyse an incoming chat message for spam/abuse.
 * @param {string} userId  - Mongo ObjectId string
 * @param {string} uid     - Public UID
 * @param {string} message - Message text
 * @param {string} roomId  - Room or chat context
 * @param {string} ip      - Sender IP
 * @returns {{ allowed: boolean, reason?: string, autoAction?: string }}
 */
const analyseMessage = async (userId, uid, message, roomId = '', ip = '') => {
  const now   = Date.now();
  const lower = message.toLowerCase().trim();

  // 1. Profanity check
  const foundWord = PROFANITY_LIST.find((w) => lower.includes(w));
  if (foundWord) {
    await _logSpam(userId, uid, roomId, 'PROFANITY_DETECTED', 'HIGH', `Word: ${foundWord}`, message.slice(0, 200), 'MUTED_5MIN', ip);
    await _muteChatUser(userId, 5);
    return { allowed: false, reason: 'Abusive language detected.', autoAction: 'MUTED_5MIN' };
  }

  // 2. Repeated message check
  const lastMsg = userLastMessages.get(userId) || '';
  if (lower === lastMsg) {
    const repeatKey = `repeat:${userId}`;
    const repeatCount = (userMessageWindows.get(repeatKey) || 0) + 1;
    userMessageWindows.set(repeatKey, repeatCount);
    if (repeatCount >= REPEAT_THRESHOLD) {
      userMessageWindows.set(repeatKey, 0);
      await _logSpam(userId, uid, roomId, 'REPEATED_MESSAGE', 'MEDIUM', `Repeated ${repeatCount}x`, message.slice(0, 200), 'MUTED_2MIN', ip);
      await _muteChatUser(userId, 2);
      return { allowed: false, reason: 'Stop sending the same message repeatedly.', autoAction: 'MUTED_2MIN' };
    }
  } else {
    userMessageWindows.delete(`repeat:${userId}`);
    userLastMessages.set(userId, lower);
  }

  // 3. Rate-of-fire check (sliding window)
  const timestamps = (userMessageWindows.get(`rate:${userId}`) || []).filter(t => now - t < 10000);
  timestamps.push(now);
  userMessageWindows.set(`rate:${userId}`, timestamps);

  if (timestamps.length > MAX_MESSAGES_PER_10S) {
    await _logSpam(userId, uid, roomId, 'RAPID_FIRE_MESSAGES', 'MEDIUM', `${timestamps.length} msgs in 10s`, '', 'MUTED_1MIN', ip);
    await _muteChatUser(userId, 1);
    return { allowed: false, reason: 'Sending messages too fast. Slow down.', autoAction: 'MUTED_1MIN' };
  }

  return { allowed: true };
};

/**
 * Validate a game action click timing to detect third-party bots/scripts.
 * The game must send a sequence of click timestamps; this checks min intervals.
 * @param {string}   userId
 * @param {string}   uid
 * @param {string}   gameType   - e.g. 'BLIND_DATE', 'PK_BATTLE', 'LUCKY_WHEEL'
 * @param {number[]} timestamps - Array of client-sent action timestamps (ms)
 */
const validateGameTiming = async (userId, uid, gameType, timestamps) => {
  if (!Array.isArray(timestamps) || timestamps.length < 2) return { valid: true };

  const intervals = [];
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push(timestamps[i] - timestamps[i - 1]);
  }

  // If median interval is < 50ms — definitely a bot (human reaction ≥ ~100ms)
  intervals.sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)];

  if (median < 50) {
    await _logSpam(userId, uid, '', 'GAME_CHEAT_ATTEMPT', 'CRITICAL', `Game: ${gameType}, MedianInterval: ${median}ms`, '', 'ACCOUNT_HOLD', '');
    await AuditLog.create({
      action: 'SUSPICIOUS_ACTIVITY',
      executorId: userId,
      executorUid: uid,
      reason: `Game cheat detected in ${gameType}. Median action interval ${median}ms.`,
    });
    return { valid: false, reason: 'Suspicious activity detected. Your account has been flagged.' };
  }

  return { valid: true };
};

// ── Private helpers ────────────────────────────────────────────────────────

const _logSpam = async (userId, uid, roomId, type, severity, details, messageContent, autoAction, ipAddress) => {
  try {
    await SpamLog.create({ userId, uid, roomId, type, severity, details, messageContent, autoAction, ipAddress });
  } catch (_) {
    // Non-blocking; never crash the message handler
  }
};

const _muteChatUser = async (userId, minutes) => {
  try {
    const muteExpiry = new Date(Date.now() + minutes * 60 * 1000);
    await User.findByIdAndUpdate(userId, {
      $set: { chatMutedUntil: muteExpiry },
    });
  } catch (_) {}
};

module.exports = { analyseMessage, validateGameTiming };
