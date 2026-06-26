const activeFamilyPKs = new Map();
const activeFamilyWars = new Map();

module.exports = (io) => {
  io.on('connection', (socket) => {
    const userId = socket.userId;

    // ─── FAMILY CHAT ────────────────────────────────────────────────────
    socket.on('family_new_message', async (data) => {
      const { familyId, familyName } = data;
      if (!familyId) return;

      try {
        await require('../models/FamilyChat')({
          familyId,
          senderUid: userId,
          senderName: data.senderName || 'Anonymous',
          senderAvatar: data.senderAvatar || '',
          messageType: data.messageType || 'text',
          content: data.content,
          replyTo: data.replyTo || null,
          attachments: data.attachments || [],
        }).save();

        io.to(`family_${familyId}`).emit('family_new_message', data);
      } catch (error) {
        console.error('Socket family message error:', error);
      }
    });

    socket.on('join_family_room', (familyId) => {
      if (!familyId) return;
      socket.join(`family_${familyId}`);
      console.log(`User ${userId} joined family room: ${familyId}`);
    });

    socket.on('leave_family_room', (familyId) => {
      if (!familyId) return;
      socket.leave(`family_${familyId}`);
      console.log(`User ${userId} left family room: ${familyId}`);
    });

    socket.on('family_chat_typing', (data) => {
      const { familyId, isTyping } = data;
      if (!familyId) return;
      socket.to(`family_${familyId}`).emit('family_chat_typing', {
        userId,
        isTyping,
      });
    });

    // ─── FAMILY PK BATTLES ──────────────────────────────────────────────
    socket.on('family_pk_join', async (data) => {
      const { battleId } = data;
      const battle = activeFamilyPKs.get(battleId);
      if (!battle) return;

      socket.join(`pk_${battleId}`);
      io.to(`pk_${battleId}`).emit('family_pk_update', battle);

      if (userId && !battle.participants.includes(userId)) {
        battle.participants.push(userId);
      }
    });

    socket.on('family_pk_send_gift', (data) => {
      const { battleId, familyId, giftValue } = data;
      const battle = activeFamilyPKs.get(battleId);
      if (!battle || battle.status !== 'live') return;

      if (battle.family1Id === familyId) {
        battle.host1Score = (battle.host1Score || 0) + giftValue;
      } else if (battle.family2Id === familyId) {
        battle.host2Score = (battle.host2Score || 0) + giftValue;
      }

      io.to(`pk_${battleId}`).emit('family_pk_update', battle);
    });

    // ─── FAMILY WARS ───────────────────────────────────────────────────
    socket.on('family_war_register', async (data) => {
      const { warId, familyId } = data;
      const war = activeFamilyWars.get(warId);
      if (!war) return;

      if (!war.participants.includes(familyId)) {
        war.participants.push(familyId);
        war.familyScores = war.familyScores || [];
        war.familyScores.push({ familyId, score: 0 });
      }

      socket.join(`war_${warId}`);
      io.to(`war_${warId}`).emit('family_war_update', war);
    });

    socket.on('family_war_score', (data) => {
      const { warId, familyId, score } = data;
      const war = activeFamilyWars.get(warId);
      if (!war) return;

      const familyScore = war.familyScores?.find((f) => f.familyId === familyId);
      if (familyScore) {
        familyScore.score += score;
      }

      war.familyScores?.sort((a, b) => b.score - a.score);

      io.to(`war_${warId}`).emit('family_war_leaderboard', {
        leaderboard: war.familyScores,
      });
      io.to(`war_${warId}`).emit('family_war_update', war);
    });

    socket.on('family_war_join', (warId) => {
      socket.join(`war_${warId}`);
    });

    socket.on('disconnect', async () => {
      try {
        const Family = require('../models/Family');
        const families = await Family.find({ 'members_list': userId });
        families.forEach((family) => {
          socket.leave(`family_${family.familyId}`);
        });
      } catch (error) {
        console.error('Socket disconnect cleanup error:', error);
      }
    });
  });

  return {
    getActiveFamilyPK: () => activeFamilyPKs,
    getActiveFamilyWars: () => activeFamilyWars,
  };
};