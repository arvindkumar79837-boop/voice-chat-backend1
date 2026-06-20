const User = require('../models/User');
const Gift = require('../models/Gift');
const GlobalSetting = require('../models/GlobalSetting');
const Agency = require('../models/Agency');

// Saare active gifts fetch karne ke liye (Flutter Store me dikhane ke liye)
exports.getGifts = async (req, res) => {
  try {
    const gifts = await Gift.find({ isActive: true });
    res.status(200).json({ gifts });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// User jab kisi ko gift send karega
exports.sendGift = async (req, res) => {
  try {
    const { receiverId, giftId, roomId } = req.body;
    const senderId = req.user.userId; // authMiddleware se aayega

    if (!receiverId || !giftId || !roomId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const gift = await Gift.findById(giftId);
    if (!gift) return res.status(404).json({ error: 'Gift not found' });

    const sender = await User.findById(senderId);
    if (sender.diamonds < gift.price) {
      return res.status(400).json({ error: 'Insufficient diamonds! Please recharge.' });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(404).json({ error: 'Receiver not found' });

    // Get System Settings for Commission Tax
    const settings = await GlobalSetting.findOne() || { giftCommission: 30 };
    const commissionRate = settings.giftCommission / 100;
    const totalReceiverCoins = Math.floor(gift.price * (1 - commissionRate));

    // --- COMMISSION ENGINE: Agency Split ---
    let finalHostCoins = totalReceiverCoins;
    
    if (receiver.agencyId) {
      const agency = await Agency.findById(receiver.agencyId);
      if (agency) {
        // Example: Agency gets 10% of the host's earnings
        const agencyCommission = Math.floor(totalReceiverCoins * 0.10);
        finalHostCoins = totalReceiverCoins - agencyCommission;
        agency.earnings = (agency.earnings || 0) + agencyCommission;
        await agency.save();
      }
    }

    // 1. Transaction: Sender se Diamonds kato, Receiver ko Coins do
    sender.diamonds -= gift.price;
    receiver.coins += finalHostCoins;

    await sender.save();
    await receiver.save();

    // 2. Real-time Socket Event Emit karo (app.js me set kiye gaye 'io' instance se)
    const io = req.app.get('io');
    const giftData = { roomId, senderName: sender.name, receiverName: receiver.name, giftName: gift.name, iconUrl: gift.iconUrl, animationType: gift.animationType };
    
    io.to(roomId).emit('receive_gift', giftData); // Uss room ke sabhi users ko animation dikhega!

    res.status(200).json({ message: 'Gift sent successfully!', balance: sender.diamonds });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};