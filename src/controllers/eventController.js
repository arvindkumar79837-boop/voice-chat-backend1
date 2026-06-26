// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/controllers/eventController.js
// ARVIND PARTY - MASTER EVENT ENGINE CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');
const Event = require('../models/Event');
const WelcomeWeekTask = require('../models/WelcomeWeekTask');
const UserEventProgress = require('../models/UserEventProgress');
const EventPrizePool = require('../models/EventPrizePool');
const FestivalGift = require('../models/FestivalGift');
const AnniversaryReward = require('../models/AnniversaryReward');
const Gift = require('../models/Gift');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const WalletTransaction = require('../models/WalletTransaction');
const { broadcastToUser } = require('../sockets/eventSocket');

class EventController {
  // ─────────────────────────────────────────────────────────────────────────
  // GET ACTIVE EVENTS FOR USER
  // GET /api/events/active
  // ─────────────────────────────────────────────────────────────────────────
  static async getActiveEvents(req, res) {
    try {
      const userId = req.user.userId;
      const user = await User.findById(userId);
      const now = new Date();

      const query = {
        is_active: true,
        status: 'active',
        start_time: { $lte: now },
        end_time: { $gte: now }
      };

      const events = await Event.find(query)
        .populate('created_by', 'name avatar')
        .sort({ 'config.highlight_priority': -1, createdAt: -1 });

      const enrichedEvents = events.map(event => {
        const meetsRequirements = this.checkEventRequirements(event, user);
        const userProgress = null;

        return {
          ...event.toObject(),
          meets_requirements: meetsRequirements,
          user_progress: userProgress,
          is_joined: event.participants.includes(userId)
        };
      });

      res.status(200).json({
        success: true,
        data: enrichedEvents,
        count: enrichedEvents.length
      });
    } catch (error) {
      console.error('Error fetching active events:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch active events'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHECK EVENT REQUIREMENTS
  // ─────────────────────────────────────────────────────────────────────────
  static checkEventRequirements(event, user) {
    const req = event.requirements || {};

    if (req.min_level && user.level < req.min_level) return false;
    if (req.min_days_active && user.daysActive < req.min_days_active) return false;
    if (req.new_user_only && !user.isNewUser) return false;
    if (req.account_age_days && user.accountAge < req.account_age_days) return false;
    if (req.vip_required && !user.isVip) return false;
    if (req.agency_required && !user.agencyId) return false;
    if (req.gender && req.gender !== '' && user.gender !== req.gender) return false;
    if (req.specific_countries && req.specific_countries.length > 0 && !req.specific_countries.includes(user.country)) return false;

    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET EVENT DETAILS
  // GET /api/events/{eventId}
  // ─────────────────────────────────────────────────────────────────────────
  static async getEventDetails(req, res) {
    try {
      const { eventId } = req.params;
      const userId = req.user.userId;

      const event = await Event.findById(eventId).populate('created_by', 'name avatar');

      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      const user = await User.findById(userId);
      const progress = await UserEventProgress.findOne({ userId, eventId });
      const prizePool = await EventPrizePool.findOne({ event_id: eventId });

      const enrichedEvent = {
        ...event.toObject(),
        meets_requirements: this.checkEventRequirements(event, user),
        user_progress: progress,
        prize_pool: prizePool
      };

      res.status(200).json({
        success: true,
        data: enrichedEvent
      });
    } catch (error) {
      console.error('Error fetching event details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch event details'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // JOIN EVENT
  // POST /api/events/{eventId}/join
  // ─────────────────────────────────────────────────────────────────────────
  static async joinEvent(req, res) {
    try {
      const { eventId } = req.params;
      const userId = req.user.userId;

      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      if (event.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Event is not active'
        });
      }

      const user = await User.findById(userId);
      if (!this.checkEventRequirements(event, user)) {
        return res.status(400).json({
          success: false,
          message: 'You do not meet the event requirements'
        });
      }

      if (event.max_participants > 0 && event.participants_count >= event.max_participants) {
        return res.status(400).json({
          success: false,
          message: 'Event is full'
        });
      }

      if (event.participants.includes(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Already joined this event'
        });
      }

      event.participants.push(userId);
      event.participants_count = event.participants.length;
      await event.save();

      if (event.event_type === 'WELCOME_WEEK') {
        await this.initializeWelcomeWeekProgress(userId, eventId);
      }

      broadcastToUser(userId, 'event_joined', {
        eventId: event._id,
        event_name: event.event_name,
        participants_count: event.participants_count
      });

      res.status(200).json({
        success: true,
        data: {
          participants_count: event.participants_count,
          message: 'Joined event successfully'
        }
      });
    } catch (error) {
      console.error('Error joining event:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to join event'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEAVE EVENT
  // POST /api/events/{eventId}/leave
  // ─────────────────────────────────────────────────────────────────────────
  static async leaveEvent(req, res) {
    try {
      const { eventId } = req.params;
      const userId = req.user.userId;

      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      if (!event.participants.includes(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Not joined this event'
        });
      }

      event.participants = event.participants.filter(id => id.toString() !== userId.toString());
      event.participants_count = event.participants.length;
      await event.save();

      await UserEventProgress.deleteMany({ userId, eventId });

      res.status(200).json({
        success: true,
        data: {
          participants_count: event.participants_count,
          message: 'Left event successfully'
        }
      });
    } catch (error) {
      console.error('Error leaving event:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to leave event'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLAIM EVENT REWARD
  // POST /api/events/{eventId}/claim
  // ─────────────────────────────────────────────────────────────────────────
  static async claimEventReward(req, res) {
    try {
      const { eventId } = req.params;
      const userId = req.user.userId;

      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      const progress = await UserEventProgress.findOne({ userId, eventId });
      if (!progress || !progress.is_completed) {
        return res.status(400).json({
          success: false,
          message: 'Event task not completed yet'
        });
      }

      if (progress.is_claimed) {
        return res.status(400).json({
          success: false,
          message: 'Reward already claimed'
        });
      }

      const user = await User.findById(userId);
      const rewards = event.reward_details;

      if (rewards.coins > 0) {
        user.coins += rewards.coins;
        await WalletTransaction.create({
          userId,
          type: 'event_reward',
          amount: rewards.coins,
          currency: 'coins',
          description: `Event reward: ${event.event_name}`,
          reference_id: eventId
        });
      }

      if (rewards.diamonds > 0) {
        user.diamonds += rewards.diamonds;
      }

      if (rewards.xp > 0) {
        user.xp += rewards.xp;
      }

      if (rewards.badges && rewards.badges.length > 0) {
        user.badges = [...(user.badges || []), ...rewards.badges];
      }

      if (rewards.frames && rewards.frames.length > 0) {
        user.frames = [...(user.frames || []), ...rewards.frames];
      }

      if (rewards.vipDays > 0) {
        user.vipExpiry = new Date(Date.now() + rewards.vipDays * 24 * 60 * 60 * 1000);
      }

      await user.save();

      progress.is_claimed = true;
      progress.claimed_at = new Date();
      await progress.save();

      broadcastToUser(userId, 'event_reward_claimed', {
        eventId: event._id,
        rewards: rewards
      });

      res.status(200).json({
        success: true,
        data: {
          rewards: rewards,
          message: 'Reward claimed successfully'
        }
      });
    } catch (error) {
      console.error('Error claiming event reward:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to claim reward'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE EVENT PROGRESS
  // POST /api/events/{eventId}/progress
  // ─────────────────────────────────────────────────────────────────────────
  static async updateProgress(req, res) {
    try {
      const { eventId } = req.params;
      const { taskId, progress_value, metadata = {} } = req.body;
      const userId = req.user.userId;

      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      let progress = await UserEventProgress.findOne({ userId, eventId, taskId });

      if (!progress) {
        progress = await UserEventProgress.create({
          userId,
          eventId,
          taskId,
          progress: 0,
          target_value: event.metadata?.welcome_week_day || 1,
          metadata
        });
      }

      progress.progress = Math.min(progress.progress + progress_value, progress.target_value);
      progress.last_activity_date = new Date();

      if (progress.progress >= progress.target_value) {
        progress.is_completed = true;
        progress.completed_at = new Date();

        broadcastToUser(userId, 'event_task_completed', {
          eventId: event._id,
          taskId: taskId,
          event_name: event.event_name
        });
      }

      await progress.save();

      res.status(200).json({
        success: true,
        data: {
          progress: progress.progress,
          target: progress.target_value,
          is_completed: progress.is_completed
        }
      });
    } catch (error) {
      console.error('Error updating progress:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update progress'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET USER EVENT HISTORY
  // GET /api/events/user/history
  // ─────────────────────────────────────────────────────────────────────────
  static async getUserEventHistory(req, res) {
    try {
      const userId = req.user.userId;
      const { page = 1, limit = 20 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const progress = await UserEventProgress.find({ userId })
        .populate('eventId', 'event_name event_type reward_details start_time end_time')
        .populate('taskId', 'task_name task_type')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await UserEventProgress.countDocuments({ userId });

      res.status(200).json({
        success: true,
        data: progress,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching user event history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch event history'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: GET ALL EVENTS
  // GET /api/events/admin/list
  // ─────────────────────────────────────────────────────────────────────────
  static async getAllEventsAdmin(req, res) {
    try {
      const { page = 1, limit = 50, type, status } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query = {};
      if (type) query.event_type = type;
      if (status) query.status = status;

      const events = await Event.find(query)
        .populate('created_by', 'name email')
        .populate('updated_by', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Event.countDocuments(query);

      res.status(200).json({
        success: true,
        data: events,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching admin events:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch events'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: CREATE EVENT
  // POST /api/events/admin/create
  // ─────────────────────────────────────────────────────────────────────────
  static async createEvent(req, res) {
    try {
      const payload = req.body;
      const adminId = req.user.userId;

      if (!payload.event_name || !payload.event_type || !payload.title || !payload.start_time || !payload.end_time) {
        return res.status(400).json({
          success: false,
          message: 'Missing required event fields'
        });
      }

      const event = await Event.create({
        ...payload,
        created_by: adminId
      });

      if (payload.event_type === 'TOURNAMENT' || payload.event_type === 'PK_BATTLE') {
        await EventPrizePool.create({
          event_id: event._id,
          total_amount: payload.metadata?.prize_pool_amount || 0,
          currency_type: 'coins',
          contribution_rules: {
            gift_percentage: payload.metadata?.gift_percentage || 10,
            recharge_percentage: 5
          },
          distribution_rules: {
            type: 'top_3_split',
            winners_count: 3
          }
        });
      }

      res.status(201).json({
        success: true,
        data: event,
        message: 'Event created successfully'
      });
    } catch (error) {
      console.error('Error creating event:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create event'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: UPDATE EVENT
  // PUT /api/events/admin/{eventId}
  // ─────────────────────────────────────────────────────────────────────────
  static async updateEvent(req, res) {
    try {
      const { eventId } = req.params;
      const payload = req.body;
      const adminId = req.user.userId;

      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      Object.assign(event, payload, { updated_by: adminId });
      await event.save();

      res.status(200).json({
        success: true,
        data: event,
        message: 'Event updated successfully'
      });
    } catch (error) {
      console.error('Error updating event:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update event'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: DELETE EVENT
  // DELETE /api/events/admin/{eventId}
  // ─────────────────────────────────────────────────────────────────────────
  static async deleteEvent(req, res) {
    try {
      const { eventId } = req.params;

      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      await Event.findByIdAndDelete(eventId);
      await UserEventProgress.deleteMany({ eventId });
      await EventPrizePool.deleteMany({ event_id: eventId });

      res.status(200).json({
        success: true,
        message: 'Event deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting event:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete event'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: MANAGE WELCOME WEEK TASKS
  // ─────────────────────────────────────────────────────────────────────────
  static async getWelcomeWeekTasks(req, res) {
    try {
      const tasks = await WelcomeWeekTask.find().sort({ day_number: 1, display_order: 1 });
      res.status(200).json({
        success: true,
        data: tasks
      });
    } catch (error) {
      console.error('Error fetching welcome week tasks:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tasks'
      });
    }
  }

  static async createWelcomeWeekTask(req, res) {
    try {
      const task = await WelcomeWeekTask.create(req.body);
      res.status(201).json({
        success: true,
        data: task,
        message: 'Task created successfully'
      });
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create task'
      });
    }
  }

  static async updateWelcomeWeekTask(req, res) {
    try {
      const { taskId } = req.params;
      const task = await WelcomeWeekTask.findByIdAndUpdate(taskId, req.body, { new: true });
      res.status(200).json({
        success: true,
        data: task,
        message: 'Task updated successfully'
      });
    } catch (error) {
      console.error('Error updating task:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update task'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: MANAGE FESTIVAL GIFTS
  // ─────────────────────────────────────────────────────────────────────────
  static async getFestivalGifts(req, res) {
    try {
      const { festival_type } = req.query;
      const query = { is_active: true };
      if (festival_type) query.festival_type = festival_type;

      const gifts = await FestivalGift.find(query).sort({ createdAt: -1 });
      res.status(200).json({
        success: true,
        data: gifts
      });
    } catch (error) {
      console.error('Error fetching festival gifts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch festival gifts'
      });
    }
  }

  static async createFestivalGift(req, res) {
    try {
      const gift = await FestivalGift.create(req.body);
      res.status(201).json({
        success: true,
        data: gift,
        message: 'Festival gift created successfully'
      });
    } catch (error) {
      console.error('Error creating festival gift:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create festival gift'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: MANAGE ANNIVERSARY REWARDS
  // ─────────────────────────────────────────────────────────────────────────
  static async getAnniversaryRewards(req, res) {
    try {
      const { year_anniversary } = req.query;
      const query = {};
      if (year_anniversary) query.year_anniversary = parseInt(year_anniversary);

      const rewards = await AnniversaryReward.find(query).sort({ year_anniversary: -1, category: 1, rank_position: 1 });
      res.status(200).json({
        success: true,
        data: rewards
      });
    } catch (error) {
      console.error('Error fetching anniversary rewards:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch anniversary rewards'
      });
    }
  }

  static async createAnniversaryReward(req, res) {
    try {
      const reward = await AnniversaryReward.create(req.body);
      res.status(201).json({
        success: true,
        data: reward,
        message: 'Anniversary reward created successfully'
      });
    } catch (error) {
      console.error('Error creating anniversary reward:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create anniversary reward'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: MANAGE EVENT PRIZE POOLS
  // ─────────────────────────────────────────────────────────────────────────
  static async getEventPrizePool(req, res) {
    try {
      const { eventId } = req.params;
      const pool = await EventPrizePool.findOne({ event_id: eventId });
      res.status(200).json({
        success: true,
        data: pool
      });
    } catch (error) {
      console.error('Error fetching prize pool:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch prize pool'
      });
    }
  }

  static async updateEventPrizePool(req, res) {
    try {
      const { eventId } = req.params;
      const updates = req.body;

      const pool = await EventPrizePool.findOneAndUpdate(
        { event_id: eventId },
        updates,
        { new: true, upsert: true }
      );

      res.status(200).json({
        success: true,
        data: pool,
        message: 'Prize pool updated successfully'
      });
    } catch (error) {
      console.error('Error updating prize pool:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update prize pool'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET EVENT STATS (ADMIN)
  // GET /api/events/admin/stats
  // ─────────────────────────────────────────────────────────────────────────
  static async getEventStats(req, res) {
    try {
      const totalEvents = await Event.countDocuments();
      const activeEvents = await Event.countDocuments({ status: 'active' });
      const upcomingEvents = await Event.countDocuments({ status: 'upcoming' });
      const completedEvents = await Event.countDocuments({ status: 'completed' });

      const eventTypeStats = await Event.aggregate([
        { $group: { _id: '$event_type', count: { $sum: 1 } } }
      ]);

      const totalParticipants = await Event.aggregate([
        { $group: { _id: null, total: { $sum: '$participants_count' } } }
      ]);

      res.status(200).json({
        success: true,
        data: {
          total_events: totalEvents,
          active_events: activeEvents,
          upcoming_events: upcomingEvents,
          completed_events: completedEvents,
          event_type_breakdown: eventTypeStats,
          total_participants: totalParticipants[0]?.total || 0
        }
      });
    } catch (error) {
      console.error('Error fetching event stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch event statistics'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZE WELCOME WEEK PROGRESS
  // ─────────────────────────────────────────────────────────────────────────
  static async initializeWelcomeWeekProgress(userId, eventId) {
    const tasks = await WelcomeWeekTask.find().sort({ day_number: 1, display_order: 1 });

    const progressRecords = tasks.map(task => ({
      userId,
      eventId,
      taskId: task._id,
      progress: 0,
      target_value: task.target_count,
      is_completed: false,
      is_claimed: false,
      streak_count: 0
    }));

    await UserEventProgress.insertMany(progressRecords);
    return progressRecords;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROCESS RECHARGE EVENT
  // ─────────────────────────────────────────────────────────────────────────
  static async processRechargeEvent(userId, rechargeAmount) {
    const now = new Date();
    const rechargeEvents = await Event.find({
      event_type: { $in: ['RECHARGE', 'RECHARGE_BONUS'] },
      status: 'active',
      is_active: true,
      start_time: { $lte: now },
      end_time: { $gte: now },
      'requirements.min_recharge_amount': { $lte: rechargeAmount }
    });

    for (const event of rechargeEvents) {
      const existingProgress = await UserEventProgress.findOne({ userId, eventId: event._id });
      if (!existingProgress) {
        await UserEventProgress.create({
          userId,
          eventId: event._id,
          progress: rechargeAmount,
          target_value: event.requirements.min_recharge_amount,
          is_completed: true,
          completed_at: now,
          metadata: { recharge_amount: rechargeAmount }
        });

        broadcastToUser(userId, 'recharge_event_completed', {
          eventId: event._id,
          event_name: event.event_name,
          rewards: event.reward_details
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DISTRIBUTE PRIZE POOL (TOURNAMENT/BATTLE)
  // ─────────────────────────────────────────────────────────────────────────
  static async distributePrizePool(eventId, winners) {
    const pool = await EventPrizePool.findOne({ event_id: eventId });
    if (!pool || pool.is_locked) return;

    pool.is_locked = true;
    pool.locked_at = new Date();
    await pool.save();

    const distribution = pool.distribution_rules;
    const totalPool = pool.current_amount;

    for (let i = 0; i < winners.length && i < distribution.winners_count; i++) {
      const winner = winners[i];
      const percentage = distribution.percentages[i]?.percentage || this.getDefaultPercentage(i, distribution.winners_count);
      const rewardAmount = Math.floor(totalPool * percentage / 100);

      if (pool.currency_type === 'coins' || pool.currency_type === 'mixed') {
        await WalletTransaction.create({
          userId: winner.userId,
          type: 'event_prize',
          amount: rewardAmount,
          currency: 'coins',
          description: `Event prize - Rank ${i + 1}`,
          reference_id: eventId
        });
      }
    }

    pool.distributed_at = new Date();
    await pool.save();
  }

  static getDefaultPercentage(rank, totalWinners) {
    const percentages = [50, 30, 20, 10, 5];
    return percentages[rank] || 5;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INJECT FESTIVAL GIFTS
  // ─────────────────────────────────────────────────────────────────────────
  static async injectFestivalGifts(eventId, giftIds) {
    const event = await Event.findById(eventId);
    if (!event || event.event_type !== 'FESTIVAL') {
      throw new Error('Invalid festival event');
    }

    event.reward_details.gifts = giftIds;
    await event.save();

    return {
      success: true,
      message: 'Festival gifts injected successfully',
      gifts_count: giftIds.length
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET TOURNAMENT STANDINGS
  // ─────────────────────────────────────────────────────────────────────────
  static async getTournamentStandings(req, res) {
    try {
      const { eventId } = req.params;

      const event = await Event.findById(eventId);
      if (!event || event.event_type !== 'TOURNAMENT') {
        return res.status(404).json({
          success: false,
          message: 'Tournament not found'
        });
      }

      const standings = await UserEventProgress.find({ eventId })
        .populate('userId', 'name avatar level agencyId')
        .sort({ progress: -1, completed_at: 1 })
        .limit(16);

      res.status(200).json({
        success: true,
        data: standings,
        tournament_rounds: event.metadata.tournament_rounds
      });
    } catch (error) {
      console.error('Error fetching tournament standings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tournament standings'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET USER EVENTS DASHBOARD
  // GET /api/events/dashboard
  // ─────────────────────────────────────────────────────────────────────────
  static async getUserEventsDashboard(req, res) {
    try {
      const userId = req.user.userId;
      const now = new Date();

      const activeEvents = await Event.find({
        is_active: true,
        status: 'active',
        start_time: { $lte: now },
        end_time: { $gte: now }
      }).sort({ 'config.highlight_priority': -1 });

      const myProgress = await UserEventProgress.find({ userId })
        .populate('eventId', 'event_name event_type reward_details')
        .where('is_completed').equals(false);

      const myCompletedEvents = await UserEventProgress.find({ userId, is_completed: true, is_claimed: false })
        .populate('eventId', 'event_name reward_details');

      res.status(200).json({
        success: true,
        data: {
          active_events: activeEvents,
          pending_events: myProgress,
          completed_events: myCompletedEvents
        }
      });
    } catch (error) {
      console.error('Error fetching events dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch events dashboard'
      });
    }
  }
}

module.exports = EventController;