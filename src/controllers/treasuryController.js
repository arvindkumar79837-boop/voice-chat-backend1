const TreasuryLog = require('../models/TreasuryLog');

exports.generateCoins = async (req, res) => {
  try {
    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid coin amount' });
    }
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Audit reason is required' });
    }

    const generatedBy = req.userRole || 'OWNER.WEB';
    const log = new TreasuryLog({
      amount,
      reason,
      generatedBy
    });
    await log.save();
    
    return res.status(200).json({
      success: true,
      message: `${amount} coins generated successfully.`,
      data: { amount, reason, generatedBy, timestamp: log.createdAt }
    });
  } catch (error) {
    console.error('Coin Generation Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getLogs = async (req, res) => {
  try {
    const logs = await TreasuryLog.find().sort({ createdAt: -1 }).limit(100);
    return res.status(200).json({ success: true, data: logs });
  } catch (error) {
    console.error('Fetch Logs Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};