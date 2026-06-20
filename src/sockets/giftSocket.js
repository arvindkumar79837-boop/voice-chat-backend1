const User = require('../models/User');
const Gift = require('../models/Gift');

module.exports = (io) => {
  io.on('connection', (socket) => {
    
    // User sends a gift in a live room
    socket.on('send_gift', async (data) => {
      try {
        const { roomId, senderId, receiverId, giftId, quantity = 1 } = data;
        
        // Fetch gift details
        const gift = await Gift.findById(giftId);
        if (!gift) return socket.emit('gift_error', { message: 'Gift not found' });

        // Fetch users
        const sender = await User.findById(senderId);
        const receiver = await User.findById(receiverId);
        const totalCost = gift.price * quantity;

        // Verify balance
        if (!sender || sender.diamonds < totalCost) {
          return socket.emit('gift_error', { message: 'Insufficient diamonds! Please recharge.' });
        }
        if (!receiver) return socket.emit('gift_error', { message: 'Receiver not found' });

        // Transaction: Deduct from sender, reward receiver
        sender.diamonds -= totalCost;
        receiver.coins += totalCost; 
        await sender.save();
        await receiver.save();

        // Broadcast the gift animation to everyone in the room!
        io.to(roomId).emit('gift_animation', {
          giftId: gift._id,
          giftImageUrl: gift.iconUrl || `https://arvind-party-cdn.com/gifts/${giftId}.svga`, 
          senderName: sender.name,
          quantity
        });
      } catch (error) {
        console.error('Gift socket error:', error);
        socket.emit('gift_error', { message: 'An error occurred while processing the gift.' });
      }
    });
  });
};