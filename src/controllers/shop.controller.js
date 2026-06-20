const User = require('../models/User');

exports.getItems = async (req, res) => {
  try {
    // TODO: In production, query these from a 'ShopItem' MongoDB collection.
    // Returning structured data here so the Flutter app's ShopController can render dynamically.
    const items = [
      { _id: 's1', name: 'Neon Frame', type: 'frame', priceDiamonds: 500, durationDays: 7 },
      { _id: 's2', name: 'Dragon Wings', type: 'frame', priceDiamonds: 1500, durationDays: 30 },
      { _id: 's3', name: 'Ferrari Mount', type: 'mount', priceDiamonds: 3000, durationDays: 7 },
      { _id: 's4', name: 'UFO Mount', type: 'mount', priceDiamonds: 10000, durationDays: 30 },
      { _id: 's5', name: 'Fire Bubble', type: 'bubble', priceDiamonds: 200, durationDays: 7 },
    ];
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

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // TODO: Fetch real item price from DB based on itemId. Using 500 as standard mock cost for now.
    const itemPrice = 500; 

    if (user.diamonds < itemPrice) {
      return res.status(400).json({ message: 'Insufficient diamonds' });
    }

    user.diamonds -= itemPrice;
    // TODO: Add item to user.inventory array
    await user.save();

    res.status(200).json({ message: 'Item purchased successfully' });
  } catch (error) {
    console.error('Purchase Error:', error);
    res.status(500).json({ message: 'Failed to process purchase transaction' });
  }
};