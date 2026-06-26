const PKBattle = require('../models/PKBattle');

module.exports = (io, socket) => {
  socket.on('pk_update_score', async ({ battleId, score, supportedUserId }) => {
    try {
      const battle = await PKBattle.findById(battleId);
      if (!battle || battle.status !== 'live') {
        return; // Ignore if battle is not live
      }

      const currentUser = socket.user.userId.toString();
      const host = battle.hostId.toString();
      const opponent = battle.opponentId.toString();

      // Determine who sent the gift and update the score
      if (currentUser === host) {
        battle.hostScore += score;
      } else if (currentUser === opponent) {
        battle.opponentScore += score;
      } else {
        // The user is a viewer, attribute score to the supported side
        if (supportedUserId) {
          if (supportedUserId === host) {
            battle.hostScore += score;
          } else if (supportedUserId === opponent) {
            battle.opponentScore += score;
          } else {
            console.warn(`PK Score: Viewer ${currentUser} supported an invalid user ${supportedUserId} in battle ${battleId}`);
          }
        } else {
          // Fallback for older clients, though this is ambiguous.
          console.warn(`PK Score: Viewer ${currentUser} did not specify a supported user in battle ${battleId}. Attributing to host by default.`);
          battle.hostScore += score;
        }
      }

      await battle.save();

      // Broadcast the updated scores to the entire room
      io.to(battle.roomId.toString()).emit('pk_score_update', {
        battleId: battle._id,
        hostScore: battle.hostScore,
        opponentScore: battle.opponentScore,
      });
    } catch (error) {
      console.error('PK Score Update Error:', error);
    }
  });
};