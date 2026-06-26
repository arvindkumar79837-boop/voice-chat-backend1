const mongoose = require('mongoose');
const Event = require('../models/Event');
const UserEventProgress = require('../models/UserEventProgress');
const EventPrizePool = require('../models/EventPrizePool');
const WelcomeWeekTask = require('../models/WelcomeWeekTask');
const { broadcastToUser } = require('../utils/socketBroadcaster');

class EventSocket {
  /**
   * Initialize event socket handlers
   * @param {Object} io - Socket.IO instance
   */
  static initialize(io) {
    const eventNamespace = io.of('/events');

    eventNamespace.on('connection', (socket) => {
      const userId = socket.handshake.query.userId;
      console.log(`Event socket connected: ${userId}`);

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

          console.log(`User ${userId} joined event room: ${eventId}`);
        } catch (error) {
          console.error('Error joining event room:', error);
          socket.emit('error', { message: 'Failed to join event room' });
        }
      });

      socket.on('leave_event_room', (eventId) => {
        socket.leave(`event:${eventId}`);
        socket.emit('event_room_left', { eventId });
        console.log(`User ${userId} left event room: ${eventId}`);
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
          console.error('Error updating progress via socket:', error);
          socket.emit('error', { message: 'Failed to update progress' });
        }
      });

      socket.on('claim_event_reward', async (eventId) => {
        try {
          const progress = await UserEventProgress.findOne({ userId, eventId });
          
          if (!progress || !progress.is_completed) {
            socket.emit('error', { message: 'Event task not completed yet' });
            return;
          }

          if (progress.is_claimed) {
            socket.emit('error', { message: 'Reward already claimed' });
            return;
          }

          const event = await Event.findById(eventId);
          const User = mongoose.model('User');
          const user = await User.findById(userId);
          const rewards = event.reward_details;

          if (rewards.coins > 0) {
            user.coins += rewards.coins;
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
          console.error('Error claiming reward via socket:', error);
          socket.emit('error', { message: 'Failed to claim reward' });
        }
      });

      socket.on('disconnect', () => {
        console.log(`Event socket disconnected: ${userId}`);
      });
    });

    console.log('Event socket initialized on /events namespace');
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