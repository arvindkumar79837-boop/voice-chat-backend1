const Logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const RoomLevel = require('../models/RoomLevel');
const RoomFollower = require('../models/RoomFollower');
const Room = require('../models/Room');
const User = require('../models/User');

const onlineUsersInRooms = {};

function setupRoomFeaturesSocket(io) {
  const roomFeaturesNamespace = io.of('/room-features');

  roomFeaturesNamespace.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token || socket.handshake.headers.authorization?.split(' ')[1];
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.userId = decoded.userId || decoded.id || decoded.uid;
      socket.data.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  roomFeaturesNamespace.on('connection', (socket) => {
    Logger.info(`[RoomFeaturesSocket] Client connected: ${socket.id}`);

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
        Logger.error('[RoomFeaturesSocket] join-room error:', error.message);
      }
    });

    socket.on('leave-room', (data) => {
      try {
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
      } catch (error) {
        Logger.error('[leave-room] error:', error.message);
        socket.emit('error', { message: 'Something went wrong. Please try again.' });
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
        Logger.error('[RoomFeaturesSocket] send-chat-message error:', error.message);
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
        Logger.error('[RoomFeaturesSocket] send-gift error:', error.message);
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
        Logger.error('[RoomFeaturesSocket] notice-update error:', error.message);
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
        Logger.error('[RoomFeaturesSocket] level-up-broadcast error:', error.message);
      }
    });

    socket.on('privacy-changed', (data) => {
      try {
        roomFeaturesNamespace.to(`room:${data.roomId}`).emit('room-privacy-updated', {
          roomId: data.roomId,
          roomType: data.roomType,
          privacyMode: data.privacyMode,
          updatedBy: data.updatedBy,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        Logger.error('[privacy-changed] error:', error.message);
        socket.emit('error', { message: 'Something went wrong. Please try again.' });
      }
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
        Logger.error('[RoomFeaturesSocket] track-time error:', error.message);
      }
    });

    socket.on('request-online-count', async (data) => {
      try {
        const { roomId } = data;
        if (roomId && onlineUsersInRooms[roomId]) {
          socket.emit('online-count-update', { roomId, onlineCount: onlineUsersInRooms[roomId].size });
        }
      } catch (error) {
        Logger.error('[request-online-count] error:', error.message);
      }
    });

    // ─── MUSIC / KARAOKE BROADCAST ──────────────────────────────────────
    socket.on('music:play', async (data) => {
      try {
        const { roomId, title, url, lyricsUrl } = data;
        const room = await Room.findById(roomId);
        if (!room) return;
        const isOwner = room.ownerId.toString() === currentUserId;
        const isCoHost = (room.coHosts || []).map(id => id.toString()).includes(currentUserId);
        if (!isOwner && !isCoHost) return socket.emit('error', { message: 'Only host/co-host can play music' });

        room.currentTrack = { title: title || 'Untitled', url, startedAt: new Date(), startedBy: currentUserId, isPlaying: true, lyricsUrl: lyricsUrl || '' };
        await room.save();

        // Broadcast to all room members with server timestamp for sync
        roomFeaturesNamespace.to(`room:${roomId}`).emit('music:sync', {
          action: 'play',
          track: room.currentTrack,
          serverTimestamp: Date.now(),
        });
      } catch (error) { Logger.error('[RoomFeaturesSocket] music:play error:', error.message); }
    });

    socket.on('music:pause', async (data) => {
      try {
        const { roomId } = data;
        const room = await Room.findById(roomId);
        if (!room) return;
        room.currentTrack.isPlaying = false;
        await room.save();
        roomFeaturesNamespace.to(`room:${roomId}`).emit('music:sync', {
          action: 'pause',
          track: room.currentTrack,
          serverTimestamp: Date.now(),
        });
      } catch (error) { Logger.error('[RoomFeaturesSocket] music:pause error:', error.message); }
    });

    socket.on('music:stop', async (data) => {
      try {
        const { roomId } = data;
        const room = await Room.findById(roomId);
        if (!room) return;
        room.currentTrack = { title: '', url: '', startedAt: null, startedBy: null, isPlaying: false, lyricsUrl: '' };
        await room.save();
        roomFeaturesNamespace.to(`room:${roomId}`).emit('music:sync', {
          action: 'stop',
          track: room.currentTrack,
          serverTimestamp: Date.now(),
        });
      } catch (error) { Logger.error('[RoomFeaturesSocket] music:stop error:', error.message); }
    });

    socket.on('music:request-sync', async (data) => {
      try {
        const { roomId } = data;
        const room = await Room.findById(roomId).select('currentTrack');
        if (!room) return;
        socket.emit('music:sync', {
          action: room.currentTrack?.isPlaying ? 'play' : 'pause',
          track: room.currentTrack,
          serverTimestamp: Date.now(),
        });
      } catch (error) { Logger.error('[RoomFeaturesSocket] music:request-sync error:', error.message); }
    });

    // ─── SINGING ROOM ──────────────────────────────────────────────
    socket.on('singing:join-queue', async (data) => {
      try {
        const { roomId, songId } = data;
        const room = await Room.findById(roomId);
        if (!room || room.roomType !== 'SINGING') return;
        if (room.micQueue.map(id => id.toString()).includes(currentUserId)) return socket.emit('error', { message: 'Already in queue' });
        room.micQueue.push(currentUserId);
        room.micQueueSongs.push(songId);
        await room.save();
        socket.emit('singing:queue-joined', { position: room.micQueue.indexOf(currentUserId) + 1, queueLength: room.micQueue.length });
        roomFeaturesNamespace.to(`room:${roomId}`).emit('singing:queue-updated', { queueLength: room.micQueue.length });
      } catch (e) { Logger.error('[SingingSocket] join-queue error:', e.message); }
    });

    socket.on('singing:leave-queue', async (data) => {
      try {
        const { roomId } = data;
        const room = await Room.findById(roomId);
        if (!room) return;
        const idx = room.micQueue.findIndex(id => id.toString() === currentUserId);
        if (idx === -1) return;
        room.micQueue.splice(idx, 1);
        room.micQueueSongs.splice(idx, 1);
        await room.save();
        roomFeaturesNamespace.to(`room:${roomId}`).emit('singing:queue-updated', { queueLength: room.micQueue.length });
      } catch (e) { Logger.error('[SingingSocket] leave-queue error:', e.message); }
    });

    socket.on('singing:start', async (data) => {
      try {
        const { roomId } = data;
        const room = await Room.findById(roomId);
        if (!room) return;
        const isOwner = room.ownerId.toString() === currentUserId;
        const isCoHost = (room.coHosts || []).map(id => id.toString()).includes(currentUserId);
        if (!isOwner && !isCoHost) return socket.emit('error', { message: 'Only host can start' });
        if (room.micQueue.length === 0) return socket.emit('error', { message: 'Queue is empty' });
        const performerId = room.micQueue.shift();
        const songId = room.micQueueSongs.shift();
        room.currentPerformerId = performerId;
        room.currentSongId = songId;
        room.performanceStartedAt = new Date();
        room.singingLikeCount = 0;
        await room.save();
        const Song = require('../models/Song');
        const song = await Song.findById(songId).select('title artist audioUrl lyricsUrl durationSeconds coverImageUrl');
        await Song.findByIdAndUpdate(songId, { $inc: { totalPlays: 1 } });
        roomFeaturesNamespace.to(`room:${roomId}`).emit('singing:next-performer', {
          performerId, song, startedAt: room.performanceStartedAt, serverTimestamp: Date.now(), queueLength: room.micQueue.length
        });
      } catch (e) { Logger.error('[SingingSocket] start error:', e.message); }
    });

    socket.on('singing:end', async (data) => {
      try {
        const { roomId } = data;
        const room = await Room.findById(roomId);
        if (!room) return;
        const isOwner = room.ownerId.toString() === currentUserId;
        const isCoHost = (room.coHosts || []).map(id => id.toString()).includes(currentUserId);
        const isPerformer = room.currentPerformerId?.toString() === currentUserId;
        if (!isOwner && !isCoHost && !isPerformer) return;
        const endedPerformerId = room.currentPerformerId;
        const totalLikes = room.singingLikeCount;
        room.currentPerformerId = null;
        room.currentSongId = null;
        room.performanceStartedAt = null;
        room.singingLikeCount = 0;
        await room.save();
        roomFeaturesNamespace.to(`room:${roomId}`).emit('singing:performance-ended', { endedPerformerId, totalLikes, queueLength: room.micQueue.length });
      } catch (e) { Logger.error('[SingingSocket] end error:', e.message); }
    });

    socket.on('singing:like', async (data) => {
      try {
        const { roomId } = data;
        const room = await Room.findById(roomId);
        if (!room || !room.currentPerformerId) return;
        room.singingLikeCount = (room.singingLikeCount || 0) + 1;
        await room.save();
        roomFeaturesNamespace.to(`room:${roomId}`).emit('singing:like-count', { likeCount: room.singingLikeCount, fromUserId: currentUserId });
      } catch (e) { Logger.error('[SingingSocket] like error:', e.message); }
    });

    socket.on('singing:sync', async (data) => {
      try {
        const { roomId } = data;
        const room = await Room.findById(roomId).select('currentPerformerId currentSongId performanceStartedAt micQueue');
        if (!room) return;
        socket.emit('singing:sync-response', {
          performerId: room.currentPerformerId,
          songId: room.currentSongId,
          startedAt: room.performanceStartedAt,
          serverTimestamp: Date.now(),
          queueLength: room.micQueue.length,
        });
      } catch (e) { Logger.error('[SingingSocket] sync error:', e.message); }
    });

    socket.on('singing:remove-from-queue', async (data) => {
      try {
        const { roomId, targetUserId } = data;
        const room = await Room.findById(roomId);
        if (!room) return;
        const isOwner = room.ownerId.toString() === currentUserId;
        const isCoHost = (room.coHosts || []).map(id => id.toString()).includes(currentUserId);
        if (!isOwner && !isCoHost) return;
        const idx = room.micQueue.findIndex(id => id.toString() === targetUserId);
        if (idx === -1) return;
        room.micQueue.splice(idx, 1);
        room.micQueueSongs.splice(idx, 1);
        await room.save();
        roomFeaturesNamespace.to(`room:${roomId}`).emit('singing:queue-updated', { queueLength: room.micQueue.length, removedUserId: targetUserId });
      } catch (e) { Logger.error('[SingingSocket] remove-from-queue error:', e.message); }
    });

    socket.on('disconnect', () => {
      try {
        Logger.info(`[RoomFeaturesSocket] Client disconnected: ${socket.id}`);
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
      } catch (error) {
        Logger.error('[RoomFeaturesSocket] disconnect error:', error.message);
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