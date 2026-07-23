const Logger = require('../utils/logger');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const UserEventProgress = require('../models/UserEventProgress');
const EventPrizePool = require('../models/EventPrizePool');
const WelcomeWeekTask = require('../models/WelcomeWeekTask');


class EventSocket {
  /**
   * Initialize event socket handlers
   * @param {Object} io - Socket.IO instance
   */
  static initialize(io) {
    const eventNamespace = io.of('/events');

    eventNamespace.use((socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));
      try {
        const { verifyAccessToken } = require('../utils/jwt');
        const decoded = verifyAccessToken(token);
        socket.data.userId = decoded.id || decoded.uid;
        socket.data.userRole = decoded.role;
        next();
      } catch (err) {
        next(new Error('Invalid or expired token'));
      }
    });

    eventNamespace.on('connection', (socket) => {
      const userId = socket.data?.userId;
      Logger.info(`Event socket connected: ${userId}`);

      socket.on('join_event_room', async (eventId) => {
        try {
          const event = await Event.findById(eventId);
          if (!event) {
            socket.emit('error', { message: 'Event not found' });
            return;
          }

          socket.join(`event:${eventId}`);
          socket.join(`user:${userId}:events`);

          socket.emit('event_room_joined', {
            eventId,
            event_name: event.event_name,
            participants_count: event.participants_count
          });

          Logger.info(`User ${userId} joined event room: ${eventId}`);
        } catch (error) {
          Logger.error('Error joining event room:', error);
          socket.emit('error', { message: 'Failed to join event room' });
        }
      });

      socket.on('leave_event_room', (eventId) => {
        socket.leave(`event:${eventId}`);
        socket.emit('event_room_left', { eventId });
        Logger.info(`User ${userId} left event room: ${eventId}`);
      });

      socket.on('update_event_progress', async (data) => {
        try {
          const { eventId, taskId, progress_value, metadata } = data;

          const progress = await UserEventProgress.findOne({ userId, eventId, taskId });
          if (!progress) {
            socket.emit('error', { message: 'Progress not found' });
            return;
          }

          progress.progress = Math.min(progress.progress + progress_value, progress.target_value);
          progress.last_activity_date = new Date();

          if (progress.progress >= progress.target_value) {
            progress.is_completed = true;
            progress.completed_at = new Date();

            const event = await Event.findById(eventId);

            socket.to(`event:${eventId}`).emit('event_task_completed', {
              userId,
              eventId,
              taskId,
              event_name: event.event_name
            });
          }

          await progress.save();

          socket.emit('progress_updated', {
            eventId,
            taskId,
            progress: progress.progress,
            target: progress.target_value,
            is_completed: progress.is_completed
          });
        } catch (error) {
          Logger.error('Error updating progress via socket:', error);
          socket.emit('error', { message: 'Failed to update progress' });
        }
      });

      socket.on('claim_event_reward', async (eventId) => {
        try {
          // Atomic claim — prevent double-claim race condition
          const progress = await UserEventProgress.findOneAndUpdate(
            { userId, eventId, is_completed: true, is_claimed: false },
            { $set: { is_claimed: true, claimed_at: new Date() } },
            { new: true }
          );

          if (!progress) {
            socket.emit('error', { message: 'Event task not completed or already claimed' });
            return;
          }

          const event = await Event.findById(eventId);
          if (!event) {
            socket.emit('error', { message: 'Event not found' });
            return;
          }

          const rewards = event.reward_details;
          const updateOps = {};

          if (rewards.coins > 0) updateOps.$inc = { ...(updateOps.$inc || {}), coins: rewards.coins };
          if (rewards.diamonds > 0) updateOps.$inc = { ...(updateOps.$inc || {}), diamonds: rewards.diamonds };
          if (rewards.xp > 0) updateOps.$inc = { ...(updateOps.$inc || {}), xp: rewards.xp };
          if (rewards.badges && rewards.badges.length > 0) updateOps.$push = { ...(updateOps.$push || {}), badges: { $each: rewards.badges } };
          if (rewards.frames && rewards.frames.length > 0) updateOps.$push = { ...(updateOps.$push || {}), frames: { $each: rewards.frames } };
          if (rewards.vipDays > 0) updateOps.$set = { ...(updateOps.$set || {}), vipExpiry: new Date(Date.now() + rewards.vipDays * 24 * 60 * 60 * 1000) };

          const User = mongoose.model('User');
          await User.findByIdAndUpdate(userId, updateOps);

          socket.emit('reward_claimed', {
            eventId,
            rewards,
            message: 'Reward claimed successfully'
          });

          socket.to(`event:${eventId}`).emit('user_claimed_reward', {
            userId,
            eventId,
            event_name: event.event_name
          });
        } catch (error) {
          Logger.error('Error claiming reward via socket:', error);
          socket.emit('error', { message: 'Failed to claim reward' });
        }
      });

      socket.on('disconnect', () => {
        Logger.info(`Event socket disconnected: ${userId}`);
      });
    });

    Logger.info('Event socket initialized on /events namespace');
  }

  /**
   * Broadcast real-time event update to all participants
   * @param {String} eventId - Event ID
   * @param {String} event - Socket event name
   * @param {Object} data - Event data
   */
  static broadcastEventUpdate(eventId, event, data) {
    const io = EventSocket.getIO();
    if (io) {
      io.to(`event:${eventId}`).emit(event, data);
    }
  }

  /**
   * Get Socket.IO instance
   * @returns {Object} - Socket.IO instance
   */
  static getIO() {
    if (global.io) {
      return global.io.of('/events');
    }
    return null;
  }

  /**
   * Notify user about event status change
   * @param {String} userId - User ID
   * @param {String} eventType - Event type
   * @param {Object} eventData - Event data
   */
  static notifyUserEventUpdate(userId, eventType, eventData) {
    const io = EventSocket.getIO();
    if (io) {
      io.to(`user:${userId}:events`).emit(eventType, eventData);
    }
  }

  /**
   * Send prize pool update
   * @param {String} eventId - Event ID
   * @param {Object} poolData - Prize pool data
   */
  static broadcastPrizePoolUpdate(eventId, poolData) {
    this.broadcastEventUpdate(eventId, 'prize_pool_updated', poolData);
  }

  /**
   * Send tournament bracket update
   * @param {String} eventId - Event ID
   * @param {Object} bracketData - Bracket data
   */
  static broadcastTournamentUpdate(eventId, bracketData) {
    this.broadcastEventUpdate(eventId, 'tournament_updated', bracketData);
  }

  /**
   * Send festival gifts injection notification
   * @param {String} eventId - Event ID
   * @param {Array} gifts - Gift data
   */
  static broadcastFestivalGifts(eventId, gifts) {
    this.broadcastEventUpdate(eventId, 'festival_gifts_injected', {
      gifts,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = EventSocket;