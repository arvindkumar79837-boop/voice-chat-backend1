const Logger = require('../utils/logger');
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

      let update = {};
      if (currentUser === host) {
        update = { $inc: { hostScore: score } };
      } else if (currentUser === opponent) {
        update = { $inc: { opponentScore: score } };
      } else {
        if (supportedUserId) {
          if (supportedUserId === host) {
            update = { $inc: { hostScore: score } };
          } else if (supportedUserId === opponent) {
            update = { $inc: { opponentScore: score } };
          } else {
            return;
          }
        }
      }

      const updatedBattle = await PKBattle.findByIdAndUpdate(
        battleId,
        update,
        { new: true }
      );

      if (updatedBattle) {
        io.to(updatedBattle.roomId.toString()).emit('pk_score_update', {
          battleId: updatedBattle._id,
          hostScore: updatedBattle.hostScore,
          opponentScore: updatedBattle.opponentScore,
        });
      }
    } catch (error) {
      Logger.error('PK Score Update Error:', error);
    }
  });
};