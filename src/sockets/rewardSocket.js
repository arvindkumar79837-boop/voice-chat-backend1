// ═══════════════════════════════════════════════════════════════════════════
// SOCKET: rewardSocket — Real-time reward config broadcasting
// ═══════════════════════════════════════════════════════════════════════════

const RewardConfig = require('../models/RewardConfig');

/**
 * Initialize reward socket handlers
 */
const initRewardSocket = (io) => {

  // Namespace for game-specific events
  const gameNamespace = io.of('/game');

  gameNamespace.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required for /game namespace'));
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.userId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  gameNamespace.on('connection', (socket) => {
    console.log(`Client connected to game socket: ${socket.id}`);

    // Join game-specific room
    socket.on('join_game_room', (gameType) => {
      socket.join(`game:${gameType}`);
      console.log(`Socket ${socket.id} joined room: game:${gameType}`);
    });

    // Leave game room
    socket.on('leave_game_room', (gameType) => {
      socket.leave(`game:${gameType}`);
      console.log(`Socket ${socket.id} left room: game:${gameType}`);
    });

    // Request current active config
    socket.on('get_active_config', async (gameType) => {
      try {
        const config = await RewardConfig.findOne({ gameType, isActive: true })
          .sort({ createdAt: -1 })
          .lean();
        
        socket.emit('active_config', {
          gameType,
          config,
          timestamp: new Date()
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to fetch active config' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`Client disconnected from game socket: ${socket.id}`);
    });
  });

  return gameNamespace;
};

const _io = () => {
  try {
    return require('../config/socket').getIO();
  } catch {
    return require('socket.io')();
  }
};

/**
 * Broadcast reward config update to all connected clients
 */
const broadcastConfigUpdate = async (config) => {
  try {
    const ioInstance = _io();
    ioInstance.to(`game:${config.gameType}`).emit('reward_config_updated', {
      configId: config._id,
      configName: config.configName,
      gameType: config.gameType,
      version: config.version,
      timestamp: new Date()
    });
    if (config.isActive) {
      ioInstance.to(`game:${config.gameType}`).emit('reward_config_deployed', {
        configId: config._id,
        configName: config.configName,
        gameType: config.gameType,
        version: config.version,
        timestamp: new Date()
      });
    }
  } catch (error) {
    console.error('Broadcast config update error:', error);
  }
};

const broadcastPrizeUpdate = async (gameType, prizeData) => {
  try {
    const ioInstance = _io();
    ioInstance.to(`game:${gameType}`).emit('prize_won', {
      ...prizeData,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Broadcast prize update error:', error);
  }
};

const broadcastJackpotHit = async (gameType, jackpotData) => {
  try {
    const ioInstance = _io();
    ioInstance.to(`game:${gameType}`).emit('jackpot_hit', {
      ...jackpotData,
      timestamp: new Date()
    });
    ioInstance.emit('global_jackpot', {
      gameType, ...jackpotData,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Broadcast jackpot error:', error);
  }
};

const broadcastAssetUpdate = async (assetType, action, assetData) => {
  try {
    const ioInstance = _io();
    ioInstance.emit('asset_library_updated', {
      assetType, action,
      asset: assetData,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Broadcast asset update error:', error);
  }
};

module.exports = {
  initRewardSocket,
  broadcastConfigUpdate,
  broadcastPrizeUpdate,
  broadcastJackpotHit,
  broadcastAssetUpdate
};