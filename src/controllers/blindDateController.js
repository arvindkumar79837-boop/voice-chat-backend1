const BlindDateProfile = require('../models/BlindDateProfile');
const BlindDateSession = require('../models/BlindDateSession');
const IcebreakerPrompt = require('../models/IcebreakerPrompt');
const User = require('../models/User');
const ContentReport = require('../models/ContentReport');
const SystemSettings = require('../models/SystemSettings');
const { getRedisClient } = require('../config/redis');

const QUEUE_KEY = 'blind_date:queue';
const QUEUE_LOCK_KEY = 'blind_date:match_lock';

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    let profile = await BlindDateProfile.findOne({ userId });
    if (!profile) profile = await BlindDateProfile.create({ userId });
    return res.json({ success: true, data: profile });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { genderPreference, ageRangeMin, ageRangeMax, countryPreference, isEnabled } = req.body;
    const user = await User.findById(userId).select('birthDate');
    if (user?.birthDate) {
      const age = Math.floor((Date.now() - new Date(user.birthDate).getTime()) / (365.25 * 86400000));
      if (age < 18) return res.status(403).json({ success: false, message: 'Must be 18+ to use Blind Date' });
    }
    const updates = {};
    if (genderPreference !== undefined) updates.genderPreference = genderPreference;
    if (ageRangeMin !== undefined) updates.ageRangeMin = Math.max(18, ageRangeMin);
    if (ageRangeMax !== undefined) updates.ageRangeMax = Math.min(99, ageRangeMax);
    if (countryPreference !== undefined) updates.countryPreference = countryPreference;
    if (isEnabled !== undefined) updates.isEnabled = isEnabled;
    const profile = await BlindDateProfile.findOneAndUpdate({ userId }, { $set: updates }, { new: true, upsert: true });
    return res.json({ success: true, data: profile });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.joinQueue = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const user = await User.findById(userId).select('name avatar birthDate lastLoginLocation');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.birthDate) {
      const age = Math.floor((Date.now() - new Date(user.birthDate).getTime()) / (365.25 * 86400000));
      if (age < 18) return res.status(403).json({ success: false, message: 'Must be 18+' });
    }
    let profile = await BlindDateProfile.findOne({ userId });
    if (!profile) profile = await BlindDateProfile.create({ userId, isEnabled: true });
    if (!profile.isEnabled) { profile.isEnabled = true; await profile.save(); }
    const now = new Date();
    if (!profile.dailyQueueResetAt || profile.dailyQueueResetAt.toDateString() !== now.toDateString()) {
      profile.dailyQueueCount = 0; profile.dailyQueueResetAt = now;
    }
    if (profile.dailyQueueCount >= 20) return res.status(429).json({ success: false, message: 'Daily limit reached (20). Try tomorrow.' });
    const redis = getRedisClient();
    if (redis) {
      const entry = JSON.stringify({ userId, name: user.name, avatar: user.avatar, birthDate: user.birthDate, country: user.lastLoginLocation?.country || '', genderPreference: profile.genderPreference, ageRangeMin: profile.ageRangeMin, ageRangeMax: profile.ageRangeMax, countryPreference: profile.countryPreference, joinedAt: Date.now() });
      await redis.zadd(QUEUE_KEY, Date.now(), entry);
    }
    profile.dailyQueueCount += 1; profile.lastQueuedAt = now; await profile.save();
    return res.json({ success: true, message: 'Added to queue' });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.leaveQueue = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const redis = getRedisClient();
    if (redis) {
      const entries = await redis.zrange(QUEUE_KEY, 0, -1);
      for (const e of entries) { if (JSON.parse(e).userId === userId) { await redis.zrem(QUEUE_KEY, e); break; } }
    }
    return res.json({ success: true, message: 'Removed from queue' });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.processQueue = async () => {
  try {
    const redis = getRedisClient();
    if (!redis) return;
    const locked = await redis.set(QUEUE_LOCK_KEY, '1', 'NX', 'EX', 5);
    if (!locked) return;
    try {
      const entries = await redis.zrange(QUEUE_KEY, 0, -1);
      if (entries.length < 2) return;
      const users = entries.map(e => JSON.parse(e));
      const matched = new Set();
      for (let i = 0; i < users.length; i++) {
        if (matched.has(users[i].userId)) continue;
        for (let j = i + 1; j < users.length; j++) {
          if (matched.has(users[j].userId)) continue;
          if (isCompatible(users[i], users[j])) {
            await createMatch(users[i], users[j], redis);
            matched.add(users[i].userId); matched.add(users[j].userId); break;
          }
        }
      }
    } finally { await redis.del(QUEUE_LOCK_KEY); }
  } catch (err) { console.error('Blind date queue error:', err.message); }
};

function isCompatible(a, b) {
  const ageA = a.birthDate ? Math.floor((Date.now() - new Date(a.birthDate).getTime()) / (365.25 * 86400000)) : 25;
  const ageB = b.birthDate ? Math.floor((Date.now() - new Date(b.birthDate).getTime()) / (365.25 * 86400000)) : 25;
  if (a.genderPreference !== 'ANY' && a.genderPreference !== (b.gender || 'ANY')) return false;
  if (b.genderPreference !== 'ANY' && b.genderPreference !== (a.gender || 'ANY')) return false;
  if (ageA < a.ageRangeMin || ageA > a.ageRangeMax) return false;
  if (ageB < b.ageRangeMin || ageB > b.ageRangeMax) return false;
  if (a.countryPreference?.length > 0 && !a.countryPreference.includes(b.country)) return false;
  if (b.countryPreference?.length > 0 && !b.countryPreference.includes(a.country)) return false;
  return true;
}

async function createMatch(userA, userB, redis) {
  const entries = await redis.zrange(QUEUE_KEY, 0, -1);
  for (const e of entries) { const p = JSON.parse(e); if ([userA.userId, userB.userId].includes(p.userId)) await redis.zrem(QUEUE_KEY, e); }
  const coinCost = await SystemSettings.getValue('blindDateCoinCost') || 0;
  let coinsCharged = 0;
  if (coinCost > 0) {
    const uA = await User.findById(userA.userId).select('coins');
    const uB = await User.findById(userB.userId).select('coins');
    if ((uA?.coins || 0) < coinCost || (uB?.coins || 0) < coinCost) return;
    uA.coins -= coinCost; uB.coins -= coinCost; await uA.save(); await uB.save();
    coinsCharged = coinCost;
  }
  const prompt = await IcebreakerPrompt.aggregate([{ $match: { isActive: true } }, { $sample: { size: 1 } }]);
  const promptId = prompt.length > 0 ? prompt[0]._id : null;
  const session = await BlindDateSession.create({ userA: userA.userId, userB: userB.userId, status: 'ACTIVE', revealTimerSeconds: 120, icebreakerPromptId: promptId, coinsCharged });
  await BlindDateProfile.updateMany({ userId: { $in: [userA.userId, userB.userId] } }, { $inc: { totalDates: 1 } });
  let icebreakerText = 'Tell me something interesting about yourself!';
  if (promptId) { const p = await IcebreakerPrompt.findById(promptId).select('text'); if (p) icebreakerText = p.text; }
  session._matchData = { userA: { userId: userA.userId, name: userA.name, avatar: userA.avatar }, userB: { userId: userB.userId, name: userB.name, avatar: userB.avatar }, icebreakerText, coinsCharged };
  await session.save();
  console.log(`✅ Blind date match: ${userA.userId} <-> ${userB.userId}`);
}

exports.getSession = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const session = await BlindDateSession.findById(req.params.sessionId).populate('icebreakerPromptId', 'text category');
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.userA.toString() !== userId && session.userB.toString() !== userId) return res.status(403).json({ success: false, message: 'Not part of this session' });
    const isUserA = session.userA.toString() === userId;
    const otherUserId = isUserA ? session.userB : session.userA;
    const otherUser = await User.findById(otherUserId).select('name avatar');
    return res.json({ success: true, data: { sessionId: session._id, status: session.status, icebreaker: session.icebreakerPromptId?.text || 'Tell me something interesting!', revealTimerSeconds: session.revealTimerSeconds, startedAt: session.startedAt, coinsCharged: session.coinsCharged, myDecision: isUserA ? session.userADecision : session.userBDecision, otherUser: session.status === 'MATCHED' ? { name: otherUser?.name, avatar: otherUser?.avatar } : null } });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.decide = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { decision } = req.body;
    if (!['INTERESTED', 'PASS'].includes(decision)) return res.status(400).json({ success: false, message: 'Decision must be INTERESTED or PASS' });
    const session = await BlindDateSession.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.status !== 'ACTIVE' && session.status !== 'REVEAL_PENDING') return res.status(400).json({ success: false, message: 'Session not in decision phase' });
    const isUserA = session.userA.toString() === userId;
    if (isUserA) session.userADecision = decision; else session.userBDecision = decision;
    if (session.userADecision !== 'PENDING' && session.userBDecision !== 'PENDING') {
      if (session.userADecision === 'INTERESTED' && session.userBDecision === 'INTERESTED') {
        session.status = 'MATCHED'; session.endedAt = new Date();
        try { await User.findByIdAndUpdate(session.userA, { $addToSet: { following: session.userB, followers: session.userB } }); await User.findByIdAndUpdate(session.userB, { $addToSet: { following: session.userA, followers: session.userA } }); } catch (_) {}
        await BlindDateProfile.updateMany({ userId: { $in: [session.userA, session.userB] } }, { $inc: { totalMatches: 1 } });
        const uA = await User.findById(session.userA).select('name avatar');
        const uB = await User.findById(session.userB).select('name avatar');
        await session.save();
        return res.json({ success: true, matched: true, message: 'You matched!', data: { sessionId: session._id, otherUser: { name: isUserA ? uB?.name : uA?.name, avatar: isUserA ? uB?.avatar : uA?.avatar } } });
      } else {
        session.status = 'ENDED_NO_MATCH'; session.endedAt = new Date(); await session.save();
        return res.json({ success: true, matched: false, message: 'No match this time', data: { sessionId: session._id } });
      }
    }
    await session.save();
    return res.json({ success: true, message: 'Decision recorded', data: { waiting: true } });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.reportSession = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { reason, description } = req.body;
    const session = await BlindDateSession.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    const otherUserId = session.userA.toString() === userId ? session.userB : session.userA;
    await ContentReport.create({ reporterId: userId, reportedUserId: otherUserId, reportedContentId: session._id.toString(), contentType: 'BLIND_DATE_SESSION', reason: reason || 'HARASSMENT', description: description || '' });
    session.status = 'ENDED_REPORTED'; session.reportedBy = userId; session.reportReason = reason || 'HARASSMENT'; session.endedAt = new Date(); await session.save();
    return res.json({ success: true, message: 'Report submitted. Session ended.' });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.listPrompts = async (req, res) => {
  try { const prompts = await IcebreakerPrompt.find({ isActive: true }).sort({ usageCount: -1 }); return res.json({ success: true, data: prompts }); } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.createPrompt = async (req, res) => {
  try { const { text, category } = req.body; if (!text) return res.status(400).json({ success: false, message: 'Text required' }); const prompt = await IcebreakerPrompt.create({ text, category }); return res.json({ success: true, data: prompt }); } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.deletePrompt = async (req, res) => {
  try { await IcebreakerPrompt.findByIdAndDelete(req.params.promptId); return res.json({ success: true, message: 'Deleted' }); } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.getAllSessions = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};
    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const [sessions, total] = await Promise.all([BlindDateSession.find(filter).populate('userA', 'name avatar').populate('userB', 'name avatar').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)), BlindDateSession.countDocuments(filter)]);
    return res.json({ success: true, data: { sessions, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } } });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};
