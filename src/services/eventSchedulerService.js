/**
 * Arvind Party - Event Scheduler Service
 * Cron Job based engine that auto-activates/expires events
 */

const Event = require('../models/Event');
const Tournament = require('../models/Tournament');
const Championship = require('../models/Championship');
const DailyTask = require('../models/DailyTask');
const LuckyDraw = require('../models/LuckyDraw');
const InviteEvent = require('../models/InviteEvent');
const LoginStreak = require('../models/LoginStreak');
const UserEventProgress = require("../models/UserEventProgress");
const User = require("../models/User");

class EventSchedulerService {
  constructor() {
    this.checkInterval = null;
    this.LOG_PREFIX = '📅 EventScheduler';
    this._lastDailyTaskResetDate = null; // Track last reset to ensure daily reset
  }

  start(cronIntervalMs = 60000) {
    console.log(`${this.LOG_PREFIX} Starting event scheduler (check every ${cronIntervalMs / 1000}s)`);
    this.checkInterval = setInterval(() => {
      this.runSchedulerCycle().catch(err => {
        console.error(`${this.LOG_PREFIX} Scheduler cycle error:`, err.message);
      });
    }, cronIntervalMs);
    console.log(`${this.LOG_PREFIX} Event scheduler started`);
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log(`${this.LOG_PREFIX} Event scheduler stopped`);
    }
  }

  async runSchedulerCycle() {
    const now = new Date();

    await Promise.all([
      this.activateScheduledEvents(now),
      this.expireEvents(now),
      this.activateTournaments(now),
      this.advanceTournamentStatus(now),
      this.activateChampionships(now),
      this.activateLuckyDraws(now),
      this.expireLuckyDraws(now),
      this.expireInviteEvents(now),
      this.resetDailyTasks(now),
      this.processLoginStreaks(now),
      this.autoRenewRecurringEvents(now)
    ]);
  }

  async activateScheduledEvents(now) {
    try {
      const eventsToActivate = await Event.find({
        is_active: true,
        start_time: { $lte: now },
        end_time: { $gte: now }
      }).populate('created_by', 'name uid');

      for (const event of eventsToActivate) {
        if (event.metadata?.theme_color) {
          console.log(`${this.LOG_PREFIX} 🎉 Event ACTIVE: ${event.event_name} (theme: ${event.metadata.theme_color})`);
        }
      }

      const upcomingNowActive = await Event.find({
        is_active: false,
        start_time: { $lte: now },
        end_time: { $gte: now }
      });

      for (const event of upcomingNowActive) {
        event.is_active = true;
        await event.save();
        console.log(`${this.LOG_PREFIX} ✅ Auto-activated event: ${event.event_name}`);
      }
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Activate events error:`, error.message);
    }
  }

  async expireEvents(now) {
    try {
      const expiredEvents = await Event.find({
        is_active: true,
        end_time: { $lte: now }
      });

      for (const event of expiredEvents) {
        event.is_active = false;
        await event.save();
        console.log(`${this.LOG_PREFIX} ⏰ Expired event: ${event.event_name}`);
      }
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Expire events error:`, error.message);
    }
  }

  async activateTournaments(now) {
    try {
      const tournamentsToOpen = await Tournament.find({
        status: 'upcoming',
        registration_start: { $lte: now },
        registration_end: { $gte: now }
      });

      for (const t of tournamentsToOpen) {
        t.status = 'registration_open';
        await t.save();
        console.log(`${this.LOG_PREFIX} 🏆 Registration OPEN: ${t.tournament_name}`);
      }

      const tournamentsToStart = await Tournament.find({
        status: 'registration_open',
        registration_end: { $lte: now },
        start_time: { $lte: now },
        end_time: { $gte: now }
      });

      for (const t of tournamentsToStart) {
        t.status = 'live';
        t.current_round = 1;
        await t.save();
        console.log(`${this.LOG_PREFIX} 🏆 Tournament LIVE: ${t.tournament_name}`);
      }
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Activate tournaments error:`, error.message);
    }
  }

  async advanceTournamentStatus(now) {
    try {
      const expiredTournaments = await Tournament.find({
        status: 'live',
        end_time: { $lte: now }
      });

      for (const t of expiredTournaments) {
        t.status = 'completed';
        t.participants.sort((a, b) => b.score - a.score);
        t.participants.forEach((p, idx) => {
          p.final_rank = idx + 1;
        });
        await t.save();
        await this.distributeTournamentRewards(t);
        console.log(`${this.LOG_PREFIX} 🏆 Tournament COMPLETED: ${t.tournament_name}`);
      }
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Advance tournaments error:`, error.message);
    }
  }

  async distributeTournamentRewards(tournament) {
    try {
      const User = require('../models/User');
      const rewards = tournament.rewards;

      for (const participant of tournament.participants) {
        const user = await User.findById(participant.userId);
        if (!user) continue;

        let rewardKey = null;
        if (participant.final_rank === 1) rewardKey = 'first';
        else if (participant.final_rank === 2) rewardKey = 'second';
        else if (participant.final_rank === 3) rewardKey = 'third';
        else if (participant.final_rank > 3) {
          user.coins = (user.coins || 0) + (rewards.participation?.coins || 0);
          user.xp = (user.xp || 0) + (rewards.participation?.xp || 0);
        }

        if (rewardKey && rewards[rewardKey]) {
          const reward = rewards[rewardKey];
          user.coins = (user.coins || 0) + (reward.coins || 0);
          user.diamonds = (user.diamonds || 0) + (reward.diamonds || 0);
          user.xp = (user.xp || 0) + (reward.xp || 0);

          if (reward.vipTag && reward.vipTag.trim() !== '') {
            user.unlockedBadges = user.unlockedBadges || [];
            if (!user.unlockedBadges.includes(reward.vipTag)) {
              user.unlockedBadges.push(reward.vipTag);
            }
          }
        }

        await user.save();
      }
      console.log(`${this.LOG_PREFIX} ✅ Rewards distributed for ${tournament.tournament_name}`);
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Distribute rewards error:`, error.message);
    }
  }

  async activateChampionships(now) {
    try {
      const qualifyOpen = await Championship.find({
        status: 'upcoming',
        qualification_start: { $lte: now },
        qualification_end: { $gte: now }
      });

      for (const c of qualifyOpen) {
        c.status = 'qualification';
        await c.save();
        console.log(`${this.LOG_PREFIX} 👑 Championship Qualification OPEN: ${c.championship_name}`);
      }

      const qualifyEnded = await Championship.find({
        status: 'qualification',
        qualification_end: { $lte: now },
        start_time: { $lte: now },
        end_time: { $gte: now }
      });

      for (const c of qualifyEnded) {
        c.status = 'live';
        await c.save();
        console.log(`${this.LOG_PREFIX} 👑 Championship LIVE: ${c.championship_name}`);
      }

      const completed = await Championship.find({
        status: 'live',
        end_time: { $lte: now }
      });

      for (const c of completed) {
        c.status = 'completed';
        c.participants.sort((a, b) => b.score - a.score);
        c.participants.forEach((p, idx) => { p.final_rank = idx + 1; });
        if (c.participants.length > 0) {
          c.winner_id = c.participants[0].userId;
          c.winner_username = c.participants[0].username;
        }
        await c.save();
        await this.distributeChampionshipRewards(c);
        console.log(`${this.LOG_PREFIX} 👑 Championship COMPLETED: ${c.championship_name} (Winner: ${c.winner_username})`);
      }
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Activate championships error:`, error.message);
    }
  }

  async distributeChampionshipRewards(championship) {
    try {
      const User = require('../models/User');
      const rewards = championship.rewards;

      for (const participant of championship.participants) {
        const user = await User.findById(participant.userId);
        if (!user) continue;

        let rewardKey = '';
        if (participant.final_rank === 1) rewardKey = 'winner';
        else if (participant.final_rank === 2) rewardKey = 'runner_up';
        else if (participant.final_rank === 3) rewardKey = 'third_place';
        else if (participant.final_rank <= 100) rewardKey = 'top100';
        else continue;

        const reward = rewards[rewardKey];
        if (!reward) continue;

        user.coins = (user.coins || 0) + (reward.coins || 0);
        user.diamonds = (user.diamonds || 0) + (reward.diamonds || 0);
        user.xp = (user.xp || 0) + (reward.xp || 0);

        if (reward.vipTag && reward.vipTag.trim() !== '') {
          user.unlockedBadges = user.unlockedBadges || [];
          if (!user.unlockedBadges.includes(reward.vipTag)) {
            user.unlockedBadges.push(reward.vipTag);
          }
        }

        if (reward.specialFrame && reward.specialFrame.trim() !== '') {
          user.unlockedFrames = user.unlockedFrames || [];
          if (!user.unlockedFrames.includes(reward.specialFrame)) {
            user.unlockedFrames.push(reward.specialFrame);
          }
        }

        participant.rewards_claimed = true;
        await user.save();
      }

      await championship.save();
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Distribute championship rewards error:`, error.message);
    }
  }

  async autoRenewRecurringEvents(now) {
    try {
      const recurringEvents = await Event.find({
        is_recurring: true,
        is_active: false,
        recurrence_pattern: { $ne: 'none' }
      });

      for (const event of recurringEvents) {
        const nextStart = this.calculateNextRecurrence(event.start_time, event.recurrence_pattern);
        const nextEnd = this.calculateNextRecurrence(event.end_time, event.recurrence_pattern);

        if (nextStart <= now && nextEnd >= now) {
          event.start_time = nextStart;
          event.end_time = nextEnd;
          event.is_active = true;
          await event.save();
          console.log(`${this.LOG_PREFIX} 🔄 Renewed recurring event: ${event.event_name}`);
        }
      }
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Auto-renew events error:`, error.message);
    }
  }

  calculateNextRecurrence(date, pattern) {
    const next = new Date(date);
    const now = new Date();
    const diff = now - next;

    switch (pattern) {
      case 'daily':
        next.setDate(next.getDate() + Math.ceil(diff / (24 * 60 * 60 * 1000)) - 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7 * Math.ceil(diff / (7 * 24 * 60 * 60 * 1000)) - 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + Math.ceil(diff / (30 * 24 * 60 * 60 * 1000)) - 1);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + Math.ceil(diff / (365 * 24 * 60 * 60 * 1000)) - 1);
        break;
      default:
        break;
    }

    return next;
  }

  async getActiveEventsCount() {
    const now = new Date();

    const activeEvents = await Event.countDocuments({
      is_active: true,
      start_time: { $lte: now },
      end_time: { $gte: now }
    });

    const activeTournaments = await Tournament.countDocuments({
      status: { $in: ['registration_open', 'live'] }
    });

    const activeChampionships = await Championship.countDocuments({
      status: { $in: ['qualification', 'live'] }
    });

    const activeLuckyDraws = await LuckyDraw.countDocuments({
      is_active: true,
      start_time: { $lte: now },
      end_time: { $gte: now }
    });

    return { activeEvents, activeTournaments, activeChampionships, activeLuckyDraws };
  }

  async activateLuckyDraws(now) {
    try {
      const drawsToActivate = await LuckyDraw.find({
        is_active: false,
        start_time: { $lte: now },
        end_time: { $gte: now }
      });
      for (const draw of drawsToActivate) {
        draw.is_active = true;
        await draw.save();
        console.log(`${this.LOG_PREFIX} 🍀 Lucky Draw ACTIVE: ${draw.draw_name}`);
      }
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Activate lucky draws error:`, error.message);
    }
  }

  async expireLuckyDraws(now) {
    try {
      const expiredDraws = await LuckyDraw.find({
        is_active: true,
        end_time: { $lte: now }
      });
      for (const draw of expiredDraws) {
        draw.is_active = false;
        await draw.save();
        console.log(`${this.LOG_PREFIX} 🍀 Lucky Draw EXPIRED: ${draw.draw_name}`);
      }
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Expire lucky draws error:`, error.message);
    }
  }

  async expireInviteEvents(now) {
    try {
      const expiredInvites = await InviteEvent.find({
        is_active: true,
        expires_at: { $lte: now }
      });
      for (const invite of expiredInvites) {
        invite.is_active = false;
        invite.status = 'expired';
        await invite.save();
        console.log(`${this.LOG_PREFIX} 📨 Invite Event EXPIRED: ${invite.invite_code}`);
      }
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Expire invite events error:`, error.message);
    }
  }

  async resetDailyTasks(now) {
    try {
      const midnightToday = new Date(now);
      midnightToday.setHours(0, 0, 0, 0);

      const lastResetDate = this._lastDailyTaskResetDate || new Date(0);
      const lastResetMidnight = new Date(lastResetDate);
      lastResetMidnight.setHours(0, 0, 0, 0);

      if (midnightToday.getTime() > lastResetMidnight.getTime()) {
        // Reset all user progress for daily tasks
        await UserEventProgress.updateMany(
          { taskId: { $ne: null }, is_completed: true, is_claimed: false },
          { $set: { is_completed: false, progress: 0 } }
        ); // reset completed but unclaimed tasks to allow new attempt
        // Ideally, old progress documents should be archived/deleted and new ones created.
        // For now, we'll reset status and progress.

        this._lastDailyTaskResetDate = now;
        console.log(`${this.LOG_PREFIX} 🔄 Daily tasks reset for new day.`);
      }
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Reset daily tasks error:`, error.message);
    }
  }

  async processLoginStreaks(now) {
    try {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(now.getDate() - 2);
      twoDaysAgo.setHours(23, 59, 59, 999);

      // Find streaks that were not updated yesterday, meaning streak is broken
      const brokenStreaks = await LoginStreak.find({
        last_login_date: { $lte: twoDaysAgo },
        current_streak: { $gt: 0 }
      });

      for (const streak of brokenStreaks) {
        streak.current_streak = 0;
        // Potentially reset day 7/30 rewards here if desired, or keep them claimed indefinitely
        await streak.save();
        console.log(`${this.LOG_PREFIX} 💔 Login streak broken for user ${streak.userId}`);
      }

      // No need to activate/expire login streaks, as they are managed by user action (claimDailyLogin)

    } catch (error) {
      console.error(`${this.LOG_PREFIX} Process login streaks error:`, error.message);
    }
  }

  _lastDailyTaskResetDate = null; // Track last reset to ensure daily reset
}

const UserEventProgress = require("../models/UserEventProgress"); 
const User = require("../models/User"); 

module.exports = new EventSchedulerService();