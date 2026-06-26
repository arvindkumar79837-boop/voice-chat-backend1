// ═══════════════════════════════════════════════════════════════════════════
// SOCKET: rewardSocket — Real-time reward config broadcasting
// ═══════════════════════════════════════════════════════════════════════════

const { getSocketIo } = require('../sockets/socketManager');
const RewardConfig = require('../models/RewardConfig');

let io = null;

/**
 * Initialize reward socket handlers
 */
const initRewardSocket = (server) => {
  io = getSocketIo();

  // Namespace for game-specific events
  const gameNamespace = io.of('/game');

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

/**
 * Broadcast reward config update to all connected clients
 */
const broadcastConfigUpdate = async (config) => {
  try {
    const ioInstance = getSocketIo();
    
    // Broadcast to specific game type room
    ioInstance.to(`game:${config.gameType}`).emit('reward_config_updated', {
      configId: config._id,
      configName: config.configName,
      gameType: config.gameType,
      version: config.version,
      timestamp: new Date()
    });

    // Also broadcast deployment if active
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

/**
 * Broadcast new prize announcement
 */
const broadcastPrizeUpdate = async (gameType, prizeData) => {
  try {
    const ioInstance = getSocketIo();
    ioInstance.to(`game:${gameType}`).emit('prize_won', {
      ...prizeData,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Broadcast prize update error:', error);
  }
};

/**
 * Broadcast jackpot hit
 */
const broadcastJackpotHit = async (gameType, jackpotData) => {
  try {
    const ioInstance = getSocketIo();
    ioInstance.to(`game:${gameType}`).emit('jackpot_hit', {
      ...jackpotData,
      timestamp: new Date()
    });

    // Also broadcast to global room for all users
    ioInstance.emit('global_jackpot', {
      gameType,
      ...jackpotData,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Broadcast jackpot error:', error);
  }
};

/**
 * Broadcast asset library update
 */
const broadcastAssetUpdate = async (assetType, action, assetData) => {
  try {
    const ioInstance = getSocketIo();
    ioInstance.emit('asset_library_updated', {
      assetType,
      action, // 'add', 'update', 'delete'
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