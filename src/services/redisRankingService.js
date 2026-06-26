/**
 * Arvind Party - Redis Ranking Service
 * High-performance leaderboard using Redis Sorted Sets
 */

const redis = require('../config/redis');

class RedisRankingService {
  constructor() {
    this.client = redis;
    this.prefix = 'arvind:ranking:';
    this.TTL = 86400; // 24 hours cache TTL
  }

  // ─── HELPER: Build cache keys ───────────────────────────────────────────────
  _wealthKey(period, country = 'global') {
    return `${this.prefix}wealth:${period}:${country}`;
  }

  _charmKey(period, country = 'global') {
    return `${this.prefix}charm:${period}:${country}`;
  }

  _giftKey(period, country = 'global') {
    return `${this.prefix}gift:${period}:${country}`;
  }

  _familyKey(period, country = 'global') {
    return `${this.prefix}family:${period}:${country}`;
  }

  _agencyKey(period, country = 'global') {
    return `${this.prefix}agency:${period}:${country}`;
  }

  _roomKey(period, country = 'global') {
    return `${this.prefix}room:${period}:${country}`;
  }

  _pkKey(period, country = 'global') {
    return `${this.prefix}pk:${period}:${country}`;
  }

  _richKey(period, country = 'global') {
    return this._wealthKey(period, country);
  }

  _popularKey(period, country = 'global') {
    return this._charmKey(period, country);
  }

  _giftRankKey(giftId, period, country = 'global') {
    return `${this.prefix}gift_item:${giftId}:${period}:${country}`;
  }

  _familyMemberKey(familyId, period) {
    return `${this.prefix}family_member:${familyId}:${period}`;
  }

  // ─── HELPER: Normalize period ──────────────────────────────────────────────
  _normalizePeriod(period) {
    const p = period?.toLowerCase();
    if (!p || ['daily', 'weekly', 'monthly', 'yearly'].includes(p)) {
      return p || 'daily';
    }
    return 'daily';
  }

  // ─── HELPER: Get current period token ─────────────────────────────────────
  _getPeriodToken(period) {
    const now = new Date();
    switch (period) {
      case 'daily': {
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      }
      case 'weekly': {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        return `${start.getFullYear()}-W${Math.ceil((start.getDate() + new Date(start.getFullYear(), 0, 1).getDay()) / 7)}`;
      }
      case 'monthly': {
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }
      case 'yearly': {
        return `${now.getFullYear()}`;
      }
      default:
        return this._getPeriodToken('daily');
    }
  }

  // ─── GENERIC: Add or update member in a sorted set ────────────────────────
  async _addToSortedSet(key, memberId, score, metadata = {}) {
    try {
      const payload = JSON.stringify({ memberId, score, metadata });
      await this.client.zAdd(key, { score, value: payload });
      await this.client.expire(key, this.TTL);
      return true;
    } catch (error) {
      console.error(`Redis ZADD Error [${key}]:`, error.message);
      return false;
    }
  }

  // ─── GENERIC: Get top N from sorted set ──────────────────────────────────
  async _getTopFromSortedSet(key, limit = 100, offset = 0) {
    try {
      const results = await this.client.zRange(
        key,
        offset,
        offset + limit - 1,
        'WITHSCORES'
      );

      if (!results || results.length === 0) {
        return [];
      }

      const parsed = [];
      for (let i = 0; i < results.length; i += 2) {
        const payload = results[i];
        const score = parseFloat(results[i + 1]);
        let data = {};
        try {
          data = JSON.parse(payload);
        } catch (e) {
          data = { memberId: payload };
        }
        parsed.push({ ...data, score });
      }

      return parsed.reverse();
    } catch (error) {
      console.error(`Redis ZRANGE Error [${key}]:`, error.message);
      return [];
    }
  }

  // ─── GENERIC: Get rank of a member ───────────────────────────────────────
  async _getMemberRank(key, memberId) {
    try {
      const rank = await this.client.zRevRank(key, memberId);
      if (rank === null) return -1;
      return rank + 1;
    } catch (error) {
      console.error(`Redis ZREVRANK Error [${key}]:`, error.message);
      return -1;
    }
  }

  // ─── GENERIC: Get member score ───────────────────────────────────────────
  async _getMemberScore(key, memberId) {
    try {
      const score = await this.client.zScore(key, memberId);
      return score || 0;
    } catch (error) {
      return 0;
    }
  }

  // ─── GENERIC: Remove member ──────────────────────────────────────────────
  async _removeMember(key, memberId) {
    try {
      await this.client.zRem(key, memberId);
      return true;
    } catch (error) {
      return false;
    }
  }

  // ─── GENERIC: Get count of members ──────────────────────────────────────
  async _getCount(key) {
    try {
      return await this.client.zCard(key);
    } catch (error) {
      return 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - WEALTH RANKING (Diamonds)
  // ═══════════════════════════════════════════════════════════════════════
  async addWealthScore(userId, diamonds, country = 'global', username = '', avatar = '') {
    const period = this._getPeriodToken('daily');
    const key = this._wealthKey('daily', country);
    await this._addToSortedSet(
      key,
      userId,
      diamonds,
      { username, avatar, country, period }
    );
  }

  async getWealthRanking(period = 'daily', country = 'global', limit = 100) {
    const p = this._normalizePeriod(period);
    const key = this._wealthKey(p, country);
    return await this._getTopFromSortedSet(key, limit);
  }

  async getWealthRank(userId, period = 'daily', country = 'global') {
    const p = this._normalizePeriod(period);
    const key = this._wealthKey(p, country);
    return await this._getMemberRank(key, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - CHARM RANKING (Coins / Top Hosts)
  // ═══════════════════════════════════════════════════════════════════════
  async addCharmScore(userId, coins, country = 'global', username = '', avatar = '') {
    const period = this._getPeriodToken('daily');
    const key = this._charmKey('daily', country);
    await this._addToSortedSet(
      key,
      userId,
      coins,
      { username, avatar, country, period }
    );
  }

  async getCharmRanking(period = 'daily', country = 'global', limit = 100) {
    const p = this._normalizePeriod(period);
    const key = this._charmKey(p, country);
    return await this._getTopFromSortedSet(key, limit);
  }

  async getCharmRank(userId, period = 'daily', country = 'global') {
    const p = this._normalizePeriod(period);
    const key = this._charmKey(p, country);
    return await this._getMemberRank(key, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - GIFT RANKING (Top Gifts Used)
  // ═══════════════════════════════════════════════════════════════════════
  async addGiftUsage(giftId, userId, value = 1, country = 'global', giftName = '', giftIcon = '') {
    const period = this._getPeriodToken('daily');
    const key = this._giftKey('daily', country);
    await this._addToSortedSet(
      key,
      giftId,
      value,
      { giftName, giftIcon, country, period, giftId }
    );
  }

  async getGiftRanking(period = 'daily', country = 'global', limit = 50) {
    const p = this._normalizePeriod(period);
    const key = this._giftKey(p, country);
    return await this._getTopFromSortedSet(key, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - FAMILY RANKING
  // ═══════════════════════════════════════════════════════════════════════
  async addFamilyScore(familyId, points, country = 'global', familyName = '', icon = '') {
    const period = this._getPeriodToken('daily');
    const key = this._familyKey('daily', country);
    await this._addToSortedSet(
      key,
      familyId,
      points,
      { familyName, icon, country, period }
    );
  }

  async getFamilyRanking(period = 'daily', country = 'global', limit = 50) {
    const p = this._normalizePeriod(period);
    const key = this._familyKey(p, country);
    return await this._getTopFromSortedSet(key, limit);
  }

  async getFamilyRank(familyId, period = 'daily', country = 'global') {
    const p = this._normalizePeriod(period);
    const key = this._familyKey(p, country);
    return await this._getMemberRank(key, familyId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - AGENCY RANKING
  // ═══════════════════════════════════════════════════════════════════════
  async addAgencyScore(agencyId, diamonds, country = 'global', agencyName = '', logo = '') {
    const period = this._getPeriodToken('daily');
    const key = this._agencyKey('daily', country);
    await this._addToSortedSet(
      key,
      agencyId,
      diamonds,
      { agencyName, logo, country, period }
    );
  }

  async getAgencyRanking(period = 'daily', country = 'global', limit = 50) {
    const p = this._normalizePeriod(period);
    const key = this._agencyKey(p, country);
    return await this._getTopFromSortedSet(key, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - ROOM RANKING
  // ═══════════════════════════════════════════════════════════════════════
  async addRoomScore(roomId, trafficScore, country = 'global', roomName = '', hostName = '') {
    const period = this._getPeriodToken('daily');
    const key = this._roomKey('daily', country);
    await this._addToSortedSet(
      key,
      roomId,
      trafficScore,
      { roomName, hostName, country, period }
    );
  }

  async getRoomRanking(period = 'daily', country = 'global', limit = 50) {
    const p = this._normalizePeriod(period);
    const key = this._roomKey(p, country);
    return await this._getTopFromSortedSet(key, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - PK BATTLE RANKING
  // ═══════════════════════════════════════════════════════════════════════
  async addPKScore(userId, wins, score, country = 'global', username = '', avatar = '') {
    const period = this._getPeriodToken('daily');
    const key = this._pkKey('daily', country);
    await this._addToSortedSet(
      key,
      userId,
      score,
      { username, avatar, wins, country, period }
    );
  }

  async getPKRanking(period = 'daily', country = 'global', limit = 50) {
    const p = this._normalizePeriod(period);
    const key = this._pkKey(p, country);
    return await this._getTopFromSortedSet(key, limit);
  }

  async getPKUserWins(userId, period = 'daily', country = 'global') {
    const p = this._normalizePeriod(period);
    const key = this._pkKey(p, country);
    const results = await this._getTopFromSortedSet(key, 10000);
    const user = results.find(r => r.memberId === userId);
    return user?.wins || 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - RICH LIST (Top Spenders)
  // ═══════════════════════════════════════════════════════════════════════
  async getRichList(period = 'daily', country = 'global', limit = 100) {
    return await this.getWealthRanking(period, country, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - POPULAR LIST (Top Earners / Hosts)
  // ═══════════════════════════════════════════════════════════════════════
  async getPopularList(period = 'daily', country = 'global', limit = 100) {
    return await this.getCharmRanking(period, country, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITY - Get current user's rank across all leaderboards
  // ═══════════════════════════════════════════════════════════════════════
  async getUserAllRanks(userId, country = 'global') {
    const periods = ['daily', 'weekly', 'monthly', 'yearly'];
    const result = {};

    for (const period of periods) {
      result[`${period}_wealth`] = await this.getWealthRank(userId, period, country);
      result[`${period}_charm`] = await this.getCharmRank(userId, period, country);
      result[`${period}_family`] = await this.getFamilyRank(userId, period, country);
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITY - Get user's score across all leaderboards
  // ═══════════════════════════════════════════════════════════════════════
  async getUserScores(userId, country = 'global') {
    const wealthKey = this._wealthKey('daily', country);
    const charmKey = this._charmKey('daily', country);

    const wealthScore = await this._getMemberScore(wealthKey, userId);
    const charmScore = await this._getMemberScore(charmKey, userId);

    return {
      wealth: wealthScore,
      charm: charmScore,
      totalScore: wealthScore + charmScore
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MAINTENANCE - Flush all ranking keys for a specific period
  // ═══════════════════════════════════════════════════════════════════════
  async flushPeriod(period) {
    try {
      const p = this._normalizePeriod(period);
      const pattern = `${this.prefix}*:${p}:*`;
      const keys = await this.client.keys(pattern);

      if (keys && keys.length > 0) {
        await this.client.del(keys);
        return { success: true, flushed: keys.length };
      }
      return { success: true, flushed: 0 };
    } catch (error) {
      console.error('Redis Flush Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MAINTENANCE - Flush all ranking keys
  // ═══════════════════════════════════════════════════════════════════════
  async flushAll() {
    try {
      const pattern = `${this.prefix}*`;
      const keys = await this.client.keys(pattern);

      if (keys && keys.length > 0) {
        await this.client.del(keys);
        return { success: true, flushed: keys.length };
      }
      return { success: true, flushed: 0 };
    } catch (error) {
      console.error('Redis Flush All Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MAINTENANCE - Get stats
  // ═══════════════════════════════════════════════════════════════════════
  async getStats() {
    try {
      const pattern = `${this.prefix}*`;
      const keys = await this.client.keys(pattern);

      const stats = {
        totalKeys: keys.length,
        byPeriod: {},
        byType: {}
      };

      for (const key of keys) {
        const parts = key.split(':');
        const type = parts[2] || 'unknown';
        const period = parts[parts.length - 2] || 'unknown';

        stats.byType[type] = (stats.byType[type] || 0) + 1;
        stats.byPeriod[period] = (stats.byPeriod[period] || 0) + 1;
      }

      return stats;
    } catch (error) {
      return { totalKeys: 0, byPeriod: {}, byType: {} };
    }
  }
}

module.exports = new RedisRankingService();