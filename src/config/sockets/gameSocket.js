const jwt = require('jsonwebtoken');
const GameRecord = require('../../models/GameRecord');
const User = require('../../models/User');
const WebViewGame = require('../../models/WebViewGame');

function setupGameSocket(io) {
  const gameNamespace = io.of('/games');

  gameNamespace.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId || decoded.id;
      socket.userRole = decoded.role || 'user';
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  gameNamespace.on('connection', (socket) => {
    console.log(`🎮 Game socket connected: User ${socket.userId}, Socket ${socket.id}`);

    socket.on('join_game_room', async (gameId) => {
      try {
        const roomName = `game_${gameId}`;
        socket.join(roomName);
        console.log(`User ${socket.userId} joined game room: ${roomName}`);
        socket.emit('joined_game_room', { gameId, room: roomName });
      } catch (error) {
        console.error('Join game room error:', error);
        socket.emit('error', { message: 'Failed to join game room' });
      }
    });

    socket.on('leave_game_room', (gameId) => {
      const roomName = `game_${gameId}`;
      socket.leave(roomName);
      console.log(`User ${socket.userId} left game room: ${roomName}`);
      socket.emit('left_game_room', { gameId });
    });

    socket.on('game_action', async (data) => {
      try {
        const { sessionId, action, payload } = data;
        const gameSession = await GameRecord.findById(sessionId);
        if (!gameSession) {
          socket.emit('error', { message: 'Game session not found' });
          return;
        }
        if (gameSession.user.toString() !== socket.userId) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        const roomName = `game_${gameSession.gameId}`;
        socket.to(roomName).emit('game_update', {
          sessionId,
          action,
          payload,
          userId: socket.userId,
          timestamp: new Date()
        });

        socket.emit('game_action_confirmed', { sessionId, action });
      } catch (error) {
        console.error('Game action error:', error);
        socket.emit('error', { message: 'Failed to process game action' });
      }
    });

    socket.on('game_result', async (data) => {
      try {
        const { sessionId, winAmount, resultData } = data;
        const gameSession = await GameRecord.findById(sessionId);
        if (!gameSession || gameSession.user.toString() !== socket.userId) {
          socket.emit('error', { message: 'Invalid session' });
          return;
        }
        if (gameSession.winAmount > 0) {
          socket.emit('error', { message: 'Session already ended' });
          return;
        }

        const user = await User.findById(socket.userId);
        const game = await WebViewGame.findById(gameSession.gameId);
        if (!user || !game) {
          socket.emit('error', { message: 'User or game not found' });
          return;
        }

        gameSession.winAmount = winAmount;
        gameSession.rewardType = game.rewardType;

        if (winAmount > 0) {
          if (game.rewardType === 'COINS' || game.rewardType === 'BOTH') {
            user.coins += winAmount;
          }
          if (game.rewardType === 'DIAMONDS' || game.rewardType === 'BOTH') {
            const diamondAmount = game.rewardType === 'BOTH'
              ? Math.floor(winAmount / game.coinToDiamondRatio)
              : winAmount;
            user.diamonds = (user.diamonds || 0) + diamondAmount;
          }
          game.totalWinnings += winAmount;
        }

        game.totalPlays += 1;
        game.totalVolume += gameSession.betAmount;

        await Promise.all([user.save(), gameSession.save(), game.save()]);

        const roomName = `game_${game._id}`;
        io.to(roomName).emit('game_completed', {
          sessionId,
          userId: socket.userId,
          userName: user.name,
          winAmount,
          rewardType: game.rewardType,
          balance: { coins: user.coins, diamonds: user.diamonds }
        });

        socket.emit('game_ended', {
          success: true,
          winAmount,
          balance: { coins: user.coins, diamonds: user.diamonds }
        });
      } catch (error) {
        console.error('Game result error:', error);
        socket.emit('error', { message: 'Failed to process game result' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`🎮 Game socket disconnected: User ${socket.userId}`);
    });
  });

  return gameNamespace;
}

module.exports = setupGameSocket;