// ═══════════════════════════════════════════════════════════════════════════
// FILE: arvind-party-backend/src/sockets/matchmakingSocket.js
// ARVIND PARTY - BLIND DATE MATCHMAKING SOCKET HANDLER
// ═══════════════════════════════════════════════════════════════════════════

const User = require('../models/User');
const Room = require('../models/Room');

// In-memory queue for users searching for a match.
// For production, this should be moved to a more scalable store like Redis.
const matchmakingQueue = [];

// Simple matchmaking algorithm: finds the first two users in the queue.
const attemptToMatchUsers = async (io) => {
  if (matchmakingQueue.length >= 2) {
    const user1 = matchmakingQueue.shift();
    const user2 = matchmakingQueue.shift();

    console.log(`[Matchmaking] Attempting to match ${user1.name} with ${user2.name}`);

    try {
      // 1. Create a new private room for the matched pair
      const newRoom = new Room({
        title: `Blind Date: ${user1.name} & ${user2.name}`,
        roomType: 'PRIVATE',
        roomCategory: 'blind_date',
        ownerId: user1.userId, // Assign one user as the temporary owner
        isTemporary: true,
        maxUsers: 2,
      });
      await newRoom.save();

      // 2. Prepare the match payload for each user
      const payloadForUser1 = {
        match: { userId: user2.userId, name: user2.name, avatar: user2.avatar, age: user2.age, gender: user2.gender },
        roomId: newRoom._id.toString(),
      };
      const payloadForUser2 = {
        match: { userId: user1.userId, name: user1.name, avatar: user1.avatar, age: user1.age, gender: user1.gender },
        roomId: newRoom._id.toString(),
      };

      // 3. Emit the 'blind_date:match_found' event to each user specifically
      io.to(user1.socketId).emit('blind_date:match_found', payloadForUser1);
      io.to(user2.socketId).emit('blind_date:match_found', payloadForUser2);

      console.log(`[Matchmaking] Match found! Room ${newRoom._id} created for ${user1.name} and ${user2.name}.`);
    } catch (error) {
      console.error('[Matchmaking] Error creating room for match:', error);
      matchmakingQueue.unshift(user2);
      matchmakingQueue.unshift(user1);
    }
  }
};

// Main socket handler function, following the project's established pattern.
module.exports = (io) => {
  // This matchmaking logic does not need to be inside a connection block
  // because it's triggered by a periodic timer, not a specific client's connection event.
  // We can define the client-side event listeners on the main `io` object if needed,
  // but for a simple queue, it's better to handle it within the auth/main connection.
  // However, to strictly follow the project's pattern of one file per feature,
  // we will wrap it. The logic will still be triggered by the external setInterval.
  
  // NOTE: For a real-world scenario, this setInterval should be managed in a central place.
  // We define it here to keep the logic self-contained as per the analysis.
  // The `io` object is passed in from server.js.
  const matchmakingInterval = setInterval(() => {
    attemptToMatchUsers(io);
  }, 5000); // Try to match every 5 seconds

  console.log('✅ Matchmaking Service initialized.');

  // This part is for client-specific events, which will be registered once
  // for every connected client due to the project's architecture.
  io.on('connection', (socket) => {
    socket.on('blind_date:start_search', async () => {
      if (matchmakingQueue.some(user => user.socketId === socket.id)) return;
      try {
        const user = await User.findById(socket.data.userId).lean();
        if (!user) return;
        const queueEntry = {
          socketId: socket.id,
          userId: user._id.toString(),
          name: user.name || user.username,
          avatar: user.avatar,
          age: user.age,
          gender: user.gender,
        };
        matchmakingQueue.push(queueEntry);
        console.log(`[Matchmaking] ${queueEntry.name} joined queue. Size: ${matchmakingQueue.length}`);
        attemptToMatchUsers(io);
      } catch (error) {
        console.error('[Matchmaking] Error adding user to queue:', error);
      }
    });

    socket.on('blind_date:cancel_search', () => {
      const index = matchmakingQueue.findIndex(user => user.socketId === socket.id);
      if (index !== -1) {
        const removedUser = matchmakingQueue.splice(index, 1);
        console.log(`[Matchmaking] ${removedUser[0].name} left queue. Size: ${matchmakingQueue.length}`);
      }
    });

    socket.on('disconnect', () => {
      const index = matchmakingQueue.findIndex(user => user.socketId === socket.id);
      if (index !== -1) {
        const removedUser = matchmakingQueue.splice(index, 1);
        console.log(`[Matchmaking] ${removedUser[0].name} disconnected, removed from queue. Size: ${matchmakingQueue.length}`);
      }
    });
  });
};
