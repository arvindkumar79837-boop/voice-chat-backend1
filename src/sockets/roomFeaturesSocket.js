const RoomLevel = require('../models/RoomLevel');
const RoomFollower = require('../models/RoomFollower');
const Room = require('../models/Room');
const User = require('../models/User');

const onlineUsersInRooms = {};

function setupRoomFeaturesSocket(io) {
  const roomFeaturesNamespace = io.of('/room-features');

  roomFeaturesNamespace.on('connection', (socket) => {
    console.log(`[RoomFeaturesSocket] Client connected: ${socket.id}`);

    let currentUserId = null;
    let currentRoomId = null;

    socket.on('join-room', async (data) => {
      try {
        const { roomId, userId } = data;
        currentRoomId = roomId;
        currentUserId = userId;

        socket.join(`room:${roomId}`);

        if (!onlineUsersInRooms[roomId]) {
          onlineUsersInRooms[roomId] = new Set();
        }
        onlineUsersInRooms[roomId].add(userId || socket.id);

        const onlineCount = onlineUsersInRooms[roomId].size;
        roomFeaturesNamespace.to(`room:${roomId}`).emit('online-count-update', { roomId, onlineCount });

        roomFeaturesNamespace.to(`room:${roomId}`).emit('user-joined', {
          userId,
          onlineCount,
          timestamp: new Date().toISOString()
        });

        if (roomId) {
          const roomLevel = await RoomLevel.findOne({ roomId });
          const roomData = await Room.findOne({ roomId }).select('admins ownerId announcement welcomeMessage pinnedMessage topic isLive').lean();
          const levelConfig = roomLevel ? RoomLevel.getLevelConfig(roomLevel.currentLevel) : RoomLevel.getLevelConfig(1);

          socket.emit('room-sync', {
            roomId,
            ownerId: roomData ? roomData.ownerId : null,
            adminIds: roomData ? (roomData.admins || []).map(a => a.toString()) : [],
            announcement: roomData ? roomData.announcement || '' : '',
            welcomeMessage: roomData ? roomData.welcomeMessage || '' : '',
            pinnedMessage: roomData ? roomData.pinnedMessage || '' : '',
            topic: roomData ? roomData.topic || '' : '',
            isLive: roomData ? roomData.isLive : false,
            level: roomLevel ? roomLevel.currentLevel : 1,
            totalXp: roomLevel ? roomLevel.totalXpEarned : 0,
            maxAdmins: levelConfig.adminSlots,
            maxSeats: levelConfig.seatCapacity
          });
        }
      } catch (error) {
        console.error('[RoomFeaturesSocket] join-room error:', error.message);
      }
    });

    socket.on('leave-room', (data) => {
      const { roomId, userId } = data || {};
      if (roomId) {
        socket.leave(`room:${roomId}`);
        if (onlineUsersInRooms[roomId]) {
          onlineUsersInRooms[roomId].delete(userId || socket.id);
          if (onlineUsersInRooms[roomId].size === 0) {
            delete onlineUsersInRooms[roomId];
          } else {
            const onlineCount = onlineUsersInRooms[roomId].size;
            roomFeaturesNamespace.to(`room:${roomId}`).emit('online-count-update', { roomId, onlineCount });
          }
        }
        roomFeaturesNamespace.to(`room:${roomId}`).emit('user-left', {
          userId,
          timestamp: new Date().toISOString()
        });
      }
      if (currentRoomId === roomId) {
        currentRoomId = null;
        currentUserId = null;
      }
    });

    socket.on('send-chat-message', async (data) => {
      try {
        const { roomId, message, userId, userName, userAvatar, isPrivate, targetUserId } = data;
        if (!roomId || !message) return;

        const roomLevel = await RoomLevel.findOne({ roomId });
        if (roomLevel) {
          await roomLevel.addXp('chat_message');
        }

        const chatPayload = {
          roomId,
          message,
          userId,
          userName: userName || 'Anonymous',
          userAvatar: userAvatar || '',
          timestamp: new Date().toISOString(),
          messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          isPrivate: isPrivate || false
        };

        if (isPrivate && targetUserId) {
          const targetSocketId = await getSocketIdForUser(targetUserId);
          if (targetSocketId) {
            roomFeaturesNamespace.to(targetSocketId).emit('private-message', chatPayload);
          }
          socket.emit('private-message-sent', chatPayload);
        } else {
          roomFeaturesNamespace.to(`room:${roomId}`).emit('new-chat-message', chatPayload);
        }
      } catch (error) {
        console.error('[RoomFeaturesSocket] send-chat-message error:', error.message);
      }
    });

    socket.on('send-gift', async (data) => {
      try {
        const { roomId, giftValue, senderId, senderName, senderAvatar, giftName, giftAnimationUrl } = data;
        if (!roomId || !giftValue) return;

        const roomLevel = await RoomLevel.findOne({ roomId });
        if (roomLevel) {
          let action = 'gift_received_small';
          if (giftValue >= 5000) action = 'gift_received_mega';
          else if (giftValue >= 1000) action = 'gift_received_large';
          else if (giftValue >= 200) action = 'gift_received_medium';
          await roomLevel.addXp(action);
        }

        roomFeaturesNamespace.to(`room:${roomId}`).emit('gift-received', {
          roomId,
          senderId,
          senderName: senderName || 'Anonymous',
          senderAvatar: senderAvatar || '',
          giftName: giftName || 'Gift',
          giftValue,
          giftAnimationUrl: giftAnimationUrl || '',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[RoomFeaturesSocket] send-gift error:', error.message);
      }
    });

    socket.on('notice-update', async (data) => {
      try {
        const { roomId, type, content, userId } = data;
        const room = await Room.findOne({ roomId });
        if (!room) return;
        const isOwnerOrAdmin = room.ownerId.toString() === userId || (room.admins || []).some(a => a.toString() === userId);
        if (!isOwnerOrAdmin) return;

        if (type === 'announcement') room.announcement = content;
        else if (type === 'marquee') room.welcomeMessage = content;
        else if (type === 'pinned') room.pinnedMessage = content;
        else if (type === 'topic') room.topic = content;
        await room.save();

        roomFeaturesNamespace.to(`room:${roomId}`).emit('notice-changed', {
          roomId,
          type,
          content,
          updatedBy: userId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[RoomFeaturesSocket] notice-update error:', error.message);
      }
    });

    socket.on('level-up-broadcast', async (data) => {
      try {
        const { roomId, newLevel, xpGained } = data;
        const roomLevel = await RoomLevel.findOne({ roomId });
        const levelConfig = roomLevel ? RoomLevel.getLevelConfig(newLevel) : null;

        roomFeaturesNamespace.to(`room:${roomId}`).emit('room-leveled-up', {
          roomId,
          newLevel,
          xpGained,
          badgeUrl: levelConfig ? levelConfig.badgeUrl : '',
          themeUnlocked: levelConfig ? levelConfig.themeUnlocked : '',
          entryEffectUrl: levelConfig ? levelConfig.entryEffectUrl : '',
          maxAdmins: levelConfig ? levelConfig.adminSlots : 8,
          maxSeats: levelConfig ? levelConfig.seatCapacity : 12,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[RoomFeaturesSocket] level-up-broadcast error:', error.message);
      }
    });

    socket.on('privacy-changed', (data) => {
      roomFeaturesNamespace.to(`room:${data.roomId}`).emit('room-privacy-updated', {
        roomId: data.roomId,
        roomType: data.roomType,
        privacyMode: data.privacyMode,
        updatedBy: data.updatedBy,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('track-time', async (data) => {
      try {
        const { roomId, userId, minutes } = data;
        if (!roomId || !userId || !minutes) return;

        const roomLevel = await RoomLevel.findOne({ roomId });
        if (roomLevel) {
          for (let i = 0; i < Math.min(minutes, 5); i++) {
            await roomLevel.addXp('minute_spent');
          }
        }

        await RoomFollower.findOneAndUpdate(
          { roomId, userId },
          { $inc: { totalMinutesSpent: minutes, totalVisits: 0 }, lastActiveAt: new Date() },
          { upsert: false }
        );

        roomFeaturesNamespace.to(`room:${roomId}`).emit('time-tracked', {
          roomId,
          userId,
          minutes
        });
      } catch (error) {
        console.error('[RoomFeaturesSocket] track-time error:', error.message);
      }
    });

    socket.on('request-online-count', async (data) => {
      const { roomId } = data;
      if (roomId && onlineUsersInRooms[roomId]) {
        socket.emit('online-count-update', { roomId, onlineCount: onlineUsersInRooms[roomId].size });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[RoomFeaturesSocket] Client disconnected: ${socket.id}`);
      if (currentRoomId && currentUserId) {
        if (onlineUsersInRooms[currentRoomId]) {
          onlineUsersInRooms[currentRoomId].delete(currentUserId);
          if (onlineUsersInRooms[currentRoomId].size === 0) {
            delete onlineUsersInRooms[currentRoomId];
          } else {
            const onlineCount = onlineUsersInRooms[currentRoomId].size;
            roomFeaturesNamespace.to(`room:${currentRoomId}`).emit('online-count-update', { roomId: currentRoomId, onlineCount });
          }
        }
        roomFeaturesNamespace.to(`room:${currentRoomId}`).emit('user-left', {
          userId: currentUserId,
          timestamp: new Date().toISOString()
        });
      }
    });
  });
}

async function getSocketIdForUser(userId) {
  const clients = await roomFeaturesNamespace.fetchSockets();
  for (const client of clients) {
    if (client.data.userId === userId) {
      return client.id;
    }
  }
  return null;
}

module.exports = { setupRoomFeaturesSocket };