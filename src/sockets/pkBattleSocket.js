const activeBattles = new Map();

module.exports = (io) => {
  io.on('connection', (socket) => {
    // 1. Request to start a PK Battle
    socket.on('request_pk', (data) => {
      const { targetRoomId } = data;
      
      const battleId = `pk_${Date.now()}`;
      const battle = {
        battleId,
        room1Id: socket.roomId || 'room_1', 
        room2Id: targetRoomId,
        host1Id: 'host_1',
        host1Name: 'Host A (You)',
        host1Avatar: 'https://via.placeholder.com/150',
        host1Score: 0,
        host2Id: 'host_2',
        host2Name: 'Host B (Opponent)',
        host2Avatar: 'https://via.placeholder.com/150',
        host2Score: 0,
        duration: 180, // 3 minutes
        remainingSeconds: 180,
      };

      activeBattles.set(battleId, battle);

      // Broadcast the start to both rooms
      io.to(battle.room1Id).to(battle.room2Id).emit('pk_started', battle);

      // Start the server-side authoritative timer
      const timer = setInterval(() => {
        const currentBattle = activeBattles.get(battleId);
        if (!currentBattle) return clearInterval(timer);

        currentBattle.remainingSeconds -= 1;

        io.to(currentBattle.room1Id).to(currentBattle.room2Id).emit('pk_update', {
          remainingSeconds: currentBattle.remainingSeconds,
          host1Score: currentBattle.host1Score,
          host2Score: currentBattle.host2Score,
        });

        if (currentBattle.remainingSeconds <= 0) {
          clearInterval(timer);
          let winnerName = 'Tie';
          if (currentBattle.host1Score > currentBattle.host2Score) winnerName = currentBattle.host1Name;
          if (currentBattle.host2Score > currentBattle.host1Score) winnerName = currentBattle.host2Name;

          io.to(currentBattle.room1Id).to(currentBattle.room2Id).emit('pk_ended', { winnerName });
          activeBattles.delete(battleId);
        }
      }, 1000);
    });

    // 2. Receive Gifts specifically mapped to the PK
    socket.on('pk_send_gift', (data) => {
      const { battleId, hostNumber, giftValue } = data;
      const battle = activeBattles.get(battleId);
      if (!battle) return;

      if (hostNumber === 1) battle.host1Score += giftValue;
      else battle.host2Score += giftValue;

      io.to(battle.room1Id).to(battle.room2Id).emit('pk_update', {
        remainingSeconds: battle.remainingSeconds,
        host1Score: battle.host1Score,
        host2Score: battle.host2Score,
      });
    });
  });
};