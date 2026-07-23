const PKBattle = require('../models/PKBattle');
const Gift = require('../models/Gift');

module.exports = (io, socket) => {
  socket.on('pk_update_score', async ({ battleId, giftId, quantity, supportedUserId }) => {
    try {
      const battle = await PKBattle.findById(battleId);
      if (!battle || battle.status !== 'live') {
        return;
      }

      const currentUser = socket.data.userId.toString();
      const host = battle.hostId.toString();
      const opponent = battle.opponentId.toString();

      if (currentUser !== host && currentUser !== opponent && !supportedUserId) {
        return;
      }

      const gift = await Gift.findById(giftId);
      if (!gift || !gift.coinPrice) {
        return;
      }

      const validQty = Math.max(1, Math.min(parseInt(quantity) || 1, 999));
      const score = gift.coinPrice * validQty;

      if (currentUser === host) {
        battle.hostScore += score;
      } else if (currentUser === opponent) {
        battle.opponentScore += score;
      } else {
        if (supportedUserId) {
          if (supportedUserId === host) {
            battle.hostScore += score;
          } else if (supportedUserId === opponent) {
            battle.opponentScore += score;
          } else {
            return;
          }
        }
      }

      await battle.save();

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