const User = require('../models/User');
const ShopItem = require('../models/ShopItem');

exports.getItems = async (req, res) => {
  try {
    const items = await ShopItem.find({ isActive: true }).sort({ displayOrder: 1 });
    res.status(200).json({ items });
  } catch (error) {
    console.error('Get Shop Items Error:', error);
    res.status(500).json({ message: 'Failed to fetch items' });
  }
};

exports.purchaseItem = async (req, res) => {
  try {
    const { itemId } = req.body;
    const userId = req.user.userId;

    const item = await ShopItem.findById(itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.diamonds < item.priceDiamonds) {
      return res.status(400).json({ message: 'Insufficient diamonds' });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + item.durationDays);

    user.diamonds -= item.priceDiamonds;
    user.inventory.push({
      itemId: item._id,
      purchasedAt: new Date(),
      expiresAt,
    });
    await user.save();

    res.status(200).json({ message: 'Item purchased successfully', expiresAt });
  } catch (error) {
    console.error('Purchase Error:', error);
    res.status(500).json({ message: 'Failed to process purchase transaction' });
  }
};