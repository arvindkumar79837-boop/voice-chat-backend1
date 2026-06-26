const QueueService = require('../services/queueService');
const Gift = require('../models/Gift');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const Notification = require('../models/Notification');
const { getIO } = require('../config/socket');
const Logger = require('../utils/logger');

class GiftQueueWorker {
  constructor() {
    this.queueName = 'gift-processing';
    this.isRunning = false;
  }

  async start() {
    try {
      const queue = await QueueService.createQueue(this.queueName, {
        defaultJobOptions: {
          removeOnComplete: { count: 500, age: 24 * 3600 },
          removeOnFail: { count: 1000, age: 7 * 24 * 3600 },
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      });

      queue.process('send_gift', async (job) => {
        return this.processGiftSend(job);
      });

      queue.process('bulk_gift', async (job) => {
        return this.processBulkGift(job);
      });

      queue.process('gift_animation', async (job) => {
        return this.processGiftAnimation(job);
      });

      this.isRunning = true;
      Logger.info('Gift Queue Worker started', { queue: this.queueName });
      console.log('✅ Gift Queue Worker started');
    } catch (error) {
      Logger.error('Failed to start Gift Queue Worker', { error: error.message });
      console.error('❌ Gift Queue Worker failed to start:', error);
    }
  }

  async processGiftSend(job) {
    const { senderId, receiverId, giftId, roomId, message } = job.data;

    try {
      Logger.info('Processing gift send', { senderId, receiverId, giftId, roomId });

      const gift = await Gift.findById(giftId);
      if (!gift) {
        throw new Error('Gift not found');
      }

      const sender = await User.findById(senderId);
      const receiver = await User.findById(receiverId);

      if (!sender || !receiver) {
        throw new Error('User not found');
      }

      if (sender.coins < gift.price) {
        throw new Error('Insufficient coins');
      }

      sender.coins -= gift.price;
      await sender.save();

      const transaction = await WalletTransaction.create({
        userId: senderId,
        type: 'gift_sent',
        amount: -gift.price,
        currency: 'coins',
        description: `Sent ${gift.name} to ${receiver.username}`,
        metadata: {
          giftId: gift._id.toString(),
          receiverId: receiverId.toString(),
          roomId: roomId
        }
      });

      await WalletTransaction.create({
        userId: receiverId,
        type: 'gift_received',
        amount: gift.price,
        currency: 'coins',
        description: `Received ${gift.name} from ${sender.username}`,
        metadata: {
          giftId: gift._id.toString(),
          senderId: senderId.toString(),
          roomId: roomId
        }
      });

      const notification = await Notification.create({
        userId: receiverId,
        type: 'gift_received',
        title: '🎁 New Gift!',
        message: `${sender.username} sent you a ${gift.name}!`,
        data: {
          giftId: gift._id.toString(),
          giftName: gift.name,
          giftImage: gift.image,
          senderId: senderId.toString(),
          senderName: sender.username,
          senderAvatar: sender.avatar,
          roomId: roomId
        }
      });

      const io = getIO();
      if (io && roomId) {
        io.to(roomId).emit('gift_received', {
          giftId: gift._id.toString(),
          giftName: gift.name,
          giftImage: gift.image,
          giftAnimation: gift.animation,
          senderId: senderId.toString(),
          senderName: sender.username,
          senderAvatar: sender.avatar,
          senderVipLevel: sender.vipLevel || 0,
          receiverId: receiverId.toString(),
          receiverName: receiver.username,
          message: message || '',
          timestamp: new Date()
        });

        io.to(roomId).emit('notification_update', {
          notification,
          unreadCount: await Notification.countDocuments({ userId: receiverId, isRead: false })
        });
      }

      Logger.info('Gift sent successfully', {
        giftId: gift._id.toString(),
        senderId,
        receiverId,
        roomId
      });

      return {
        success: true,
        transaction,
        gift,
        sender: { id: sender._id, username: sender.username, coins: sender.coins },
        receiver: { id: receiver._id, username: receiver.username }
      };
    } catch (error) {
      Logger.error('Gift processing failed', {
        error: error.message,
        jobId: job.id,
        data: job.data
      });
      throw error;
    }
  }

  async processBulkGift(job) {
    const { senderId, giftId, receiverIds, roomId, totalAmount } = job.data;

    try {
      Logger.info('Processing bulk gift', {
        senderId,
        giftId,
        receiverCount: receiverIds.length,
        roomId
      });

      const gift = await Gift.findById(giftId);
      if (!gift) {
        throw new Error('Gift not found');
      }

      const sender = await User.findById(senderId);
      if (!sender) {
        throw new Error('Sender not found');
      }

      if (sender.coins < totalAmount) {
        throw new Error('Insufficient coins for bulk gift');
      }

      sender.coins -= totalAmount;
      await sender.save();

      const results = [];
      for (const receiverId of receiverIds) {
        try {
          const result = await this.processGiftSend({
            data: {
              senderId,
              receiverId,
              giftId,
              roomId,
              message: 'Bulk gift from ' + sender.username
            }
          });
          results.push(result);
        } catch (error) {
          Logger.error('Bulk gift item failed', {
            receiverId,
            error: error.message
          });
        }
      }

      await WalletTransaction.create({
        userId: senderId,
        type: 'bulk_gift',
        amount: -totalAmount,
        currency: 'coins',
        description: `Bulk ${gift.name} to ${receiverIds.length} users`,
        metadata: {
          giftId: gift._id.toString(),
          receiverIds: receiverIds.map(id => id.toString()),
          roomId,
          successCount: results.length
        }
      });

      Logger.info('Bulk gift completed', {
        total: receiverIds.length,
        successful: results.length,
        failed: receiverIds.length - results.length
      });

      return {
        success: true,
        successful: results.length,
        failed: receiverIds.length - results.length,
        results
      };
    } catch (error) {
      Logger.error('Bulk gift processing failed', {
        error: error.message,
        jobId: job.id
      });
      throw error;
    }
  }

  async processGiftAnimation(job) {
    const { giftId, animationType, roomId } = job.data;

    try {
      const gift = await Gift.findById(giftId);
      if (!gift || !gift.animation) {
        return { success: true, message: 'No animation for this gift' };
      }

      const io = getIO();
      if (io && roomId) {
        io.to(roomId).emit('gift_animation', {
          giftId: gift._id.toString(),
          animation: gift.animation,
          animationType: animationType || 'standard',
          duration: gift.animationDuration || 3000,
          timestamp: new Date()
        });
      }

      return { success: true };
    } catch (error) {
      Logger.error('Gift animation failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async enqueueGiftSend(data) {
    try {
      const job = await QueueService.addJob(
        this.queueName,
        'send_gift',
        data,
        { priority: data.priority || 'normal' }
      );
      return job;
    } catch (error) {
      Logger.error('Failed to enqueue gift', { error: error.message, data });
      throw error;
    }
  }

  async enqueueBulkGift(data) {
    try {
      const job = await QueueService.addJob(
        this.queueName,
        'bulk_gift',
        data,
        { priority: 'low' }
      );
      return job;
    } catch (error) {
      Logger.error('Failed to enqueue bulk gift', { error: error.message, data });
      throw error;
    }
  }

  stop() {
    this.isRunning = false;
    Logger.info('Gift Queue Worker stopped');
  }
}

module.exports = new GiftQueueWorker();