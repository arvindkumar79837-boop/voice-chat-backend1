const PKBattle = require('../models/PKBattle');
const Room = require('../models/Room');
const User =require('../models/User');
const redisRankingIntegration = require('../services/redisRankingIntegration');

const endBattleInternal = async (battleId, io) => {
  const battle = await PKBattle.findById(battleId);
  if (!battle || battle.status !== 'live') {
    return;
  }

  battle.status = 'finished';
  battle.winnerId =
    battle.hostScore > battle.opponentScore
      ? battle.hostId
      : battle.opponentScore > battle.hostScore
      ? battle.opponentId
      : null;
  await battle.save();

  if (io) {
    io.to(battle.roomId.toString()).emit('pk_end', {
      battleId: battle._id,
      winnerId: battle.winnerId,
      hostScore: battle.hostScore,
      opponentScore: battle.opponentScore,
    });
  }

  // Update PK rankings in Redis
  redisRankingIntegration
    .onPKBattleEnded(
      battle.hostId,
      battle.opponentId,
      battle.winnerId,
      battle.hostScore,
      battle.opponentScore
    )
    .catch((err) => console.error('Redis PK ranking update failed:', err.message));
};

exports.requestBattle = async (req, res) => {
  try {
    const { opponentId, roomId, durationMinutes } = req.body;
    const hostId = req.user.userId;

    // 1. Validation
    if (hostId.toString() === opponentId.toString()) {
      return res
        .status(400)
        .json({ success: false, message: 'You cannot battle yourself.' });
    }

    const room = await Room.findById(roomId);
    if (!room)
      return res.status(404).json({ success: false, message: 'Room not found.' });

    // 2. Check if a battle is already active in this room
    const existingBattle = await PKBattle.findOne({
      roomId,
      status: { $in: ['pending', 'live'] },
    });
    if (existingBattle) {
      return res.status(400).json({
        success: false,
        message: 'A PK battle is already ongoing or pending in this room.',
      });
    }

    // 3. Create Battle Request
    const battle = new PKBattle({
      hostId,
      opponentId,
      roomId,
      durationMinutes: durationMinutes || 5,
      status: 'pending',
    });
    await battle.save();

    // 4. Emit Socket Event to Opponent (App triggers a dialog to Accept/Reject)
    const io = req.app.get('io');
    if (io) {
      const hostUser = await User.findById(hostId).select('name avatar');
      io.to(opponentId.toString()).emit('pk_request', {
        battleId: battle._id,
        hostName: hostUser.name,
        hostAvatar: hostUser.avatar,
        roomId,
      });
    }

    return res
      .status(201)
      .json({ success: true, message: 'PK Battle request sent.', data: battle });
  } catch (error) {
    console.error('PK Battle Request Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.acceptBattle = async (req, res) => {
  try {
    const { battleId } = req.body;
    const opponentId = req.user.userId;

    const battle = await PKBattle.findOne({
      _id: battleId,
      opponentId,
      status: 'pending',
    });
    if (!battle) {
      return res
        .status(404)
        .json({ success: false, message: 'Battle request not found or expired.' });
    }

    // Start the battle
    battle.status = 'live';
    battle.startedAt = new Date();

    // Calculate end time
    const endTime = new Date(
      battle.startedAt.getTime() + battle.durationMinutes * 60000
    );
    battle.endedAt = endTime;
    await battle.save();

    // Emit Socket Event to the entire room to show the PK UI
    const io = req.app.get('io');
    if (io) {
      io.to(battle.roomId.toString()).emit('pk_start', {
        battleId: battle._id,
        hostId: battle.hostId,
        opponentId: battle.opponentId,
        endTime: battle.endedAt,
      });
    }

    // Automatically end the battle after the duration
    setTimeout(
      () => endBattleInternal(battle._id, io),
      battle.durationMinutes * 60000
    );

    return res
      .status(200)
      .json({ success: true, message: 'PK Battle started!', data: battle });
  } catch (error) {
    console.error('PK Battle Accept Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// End Battle logic - This should ideally be called via a Cron Job or setTimeout,
// but providing an API route for manual/fallback termination.
exports.endBattle = async (req, res) => {
  try {
    const { battleId } = req.body;
    await endBattleInternal(battleId, req.app.get('io'));
    return res.status(200).json({ success: true, message: 'PK Battle ended.' });
  } catch (error) {
    console.error('PK Battle End Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};