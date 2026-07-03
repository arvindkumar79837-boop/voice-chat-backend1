const mongoose = require('mongoose');
const User = require('../models/User');
const Wallet = require('../models/User');
const Transaction = require('../models/Transaction');
const Gift = require('../models/Gift');
const Room = require('../models/Room');
const { ApiError } = require('../utils/ApiError');
const { ApiResponse } = require('../utils/apiResponse');

/**
 * @description Handles the logic of a user sending a gift to another user.
 * @param {string} senderId - The ID of the user sending the gift.
 * @param {string} receiverId - The ID of the user receiving the gift.
 * @param {string} giftId - The ID of the gift being sent.
 * @param {string} roomId - The ID of the room where the gift is being sent.
 * @returns {Promise<object>} An object containing details of the transaction for socket emission.
 */
const sendGift = async (senderId, receiverId, giftId, roomId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const gift = await Gift.findById(giftId).session(session);
    if (!gift) {
      throw new ApiError(404, 'Gift not found');
    }

    const senderWallet = await Wallet.findOne({ userId: senderId }).session(session);
    const receiverWallet = await Wallet.findOne({ userId: receiverId }).session(session);
    const room = await Room.findById(roomId).session(session);

    if (!senderWallet || !receiverWallet) {
      throw new ApiError(404, 'Wallets not found');
    }
    if (!room) {
      throw new ApiError(404, 'Room not found');
    }

    if (senderWallet.coins < gift.price) {
      throw new ApiError(400, 'Insufficient coins');
    }

    // Perform the transaction
    senderWallet.coins -= gift.price;
    receiverWallet.diamonds += gift.price; // Assuming 1 coin = 1 diamond for simplicity

    await senderWallet.save({ session });
    await receiverWallet.save({ session });

    // Create transaction records
    const senderTransaction = new Transaction({
      userId: senderId,
      type: 'gift_sent',
      amount: gift.price,
      description: `Sent ${gift.name} to user ${receiverId} in room ${roomId}`,
      relatedUserId: receiverId,
    });

    const receiverTransaction = new Transaction({
      userId: receiverId,
      type: 'gift_received',
      amount: gift.price,
      description: `Received ${gift.name} from user ${senderId} in room ${roomId}`,
      relatedUserId: senderId,
    });

    await senderTransaction.save({ session });
    await receiverTransaction.save({ session });

    await session.commitTransaction();

    const sender = await User.findById(senderId).select('name profileImage').lean();

    return {
      gift,
      sender,
      receiverId,
      roomId,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error; // Re-throw to be caught by the socket handler
  } finally {
    session.endSession();
  }
};

module.exports = {
  sendGift,
};