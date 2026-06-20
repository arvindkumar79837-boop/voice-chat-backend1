const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  description: { type: String },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

// Default settings initializer
SystemSettings.getDefaults = async () => {
  const defaults = [
    // --- FINANCIAL RATIOS ---
    { key: 'gift_to_diamond_ratio',     value: 1.0,   description: '1 Coin Gift = X Diamonds' },
    { key: 'diamond_to_coin_ratio',     value: 0.50,  description: '1 Diamond = X Coins on exchange' },
    // --- COMMISSION RATES ---
    { key: 'merchant_commission_pct',   value: 5.0,   description: 'Merchant commission %' },
    { key: 'super_seller_commission_pct', value: 3.0, description: 'Super Seller commission %' },
    { key: 'normal_seller_commission_pct', value: 1.5,description: 'Normal Seller commission %' },
    // --- TARGET AMOUNTS ---
    { key: 'weekly_target',             value: 5000,  description: 'Default weekly target (coins)' },
    { key: '15day_target',              value: 12000, description: 'Default 15-day target (coins)' },
    { key: 'monthly_target',            value: 25000, description: 'Default monthly target (coins)' },
    // --- WITHDRAWAL LIMITS ---
    { key: 'withdrawal_daily_limit',    value: 10000, description: 'Max daily withdrawal (coins)' },
    { key: 'withdrawal_weekly_limit',   value: 50000, description: 'Max weekly withdrawal (coins)' },
    { key: 'withdrawal_monthly_limit',  value: 150000,description: 'Max monthly withdrawal (coins)' },
    { key: 'withdrawal_min_amount',     value: 500,   description: 'Minimum withdrawal (coins)' },
    // --- SETTLEMENT ---
    { key: 'settlement_cycle_days',     value: 7,     description: 'Settlement cycle in days' },
    // --- BONUS/PENALTY ---
    { key: 'target_bonus_pct',          value: 10.0,  description: 'Bonus % on target achievement' },
    { key: 'target_penalty_pct',        value: 5.0,   description: 'Penalty % on target miss' },
    // --- RATE LIMITS ---
    { key: 'gift_rate_limit_per_min',   value: 10,    description: 'Max gifts per minute per user' },
    { key: 'recharge_daily_limit',      value: 50000, description: 'Max daily recharge (coins)' },
  ];
  return defaults;
};

SystemSettings.getValue = async (key) => {
  const setting = await SystemSettings.findOne({ key });
  return setting ? setting.value : null;
};

SystemSettings.setValue = async (key, value, updatedBy) => {
  return await SystemSettings.findOneAndUpdate(
    { key },
    { value, updatedBy, updatedAt: new Date() },
    { upsert: true, new: true }
  );
};

module.exports = SystemSettings;
