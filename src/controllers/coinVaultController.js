// ═══════════════════════════════════════════════════════════════════════════
// CONTROLLER: CoinVaultController — Owner-only minting, dispatch to sellers
// ═══════════════════════════════════════════════════════════════════════════

const CoinVault = require('../models/CoinVault');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

/**
 * GET /api/treasury/vault
 * Fetch the current vault state
 */
exports.getVault = async (req, res) => {
  try {
    const vault = await CoinVault.getVault();
    return res.status(200).json({
      success: true,
      data: {
        totalCoinsMinted: vault.totalCoinsMinted,
        totalCoinsDispatched: vault.totalCoinsDispatched,
        totalCoinsBurned: vault.totalCoinsBurned,
        currentBalance: vault.currentBalance,
        lastMintDate: vault.lastMintDate,
        lastDispatchDate: vault.lastDispatchDate,
      },
    });
  } catch (error) {
    console.error('getVault Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/treasury/vault/mint
 * Owner only: mint new coins out of thin air into the global vault
 */
exports.mintCoins = async (req, res) => {
  try {
    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive coin amount required' });
    }

    const vault = await CoinVault.getVault();
    vault.totalCoinsMinted += amount;
    vault.currentBalance += amount;
    vault.lastMintDate = new Date();
    vault.mintHistory.push({
      amount,
      reason: reason || 'Owner coin minting',
      mintedBy: req.user?.userId || 'OWNER',
    });
    await vault.save();

    // Audit log
    await AuditLog.create({
      action: 'COIN_MINT',
      performedBy: req.user?.userId || 'OWNER',
      details: `Minted ${amount} coins. Reason: ${reason || 'N/A'}`,
      metadata: { amount, vaultBalance: vault.currentBalance },
    });

    return res.status(200).json({
      success: true,
      message: `${amount} coins minted successfully. Vault balance: ${vault.currentBalance}`,
      data: {
        amount,
        currentBalance: vault.currentBalance,
        totalCoinsMinted: vault.totalCoinsMinted,
      },
    });
  } catch (error) {
    console.error('mintCoins Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/treasury/vault/dispatch
 * Owner only: dispatch bulk coins to a registered Coin Seller UID
 */
exports.dispatchToSeller = async (req, res) => {
  try {
    const { sellerUid, amount, reason } = req.body;

    if (!sellerUid || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Seller UID and valid coin amount required' });
    }

    // Validate seller exists and has coin_seller role
    const seller = await User.findOne({ uid: sellerUid });
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found with this UID' });
    }

    const vault = await CoinVault.getVault();
    if (vault.currentBalance < amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient vault balance. Available: ${vault.currentBalance}, Requested: ${amount}`,
      });
    }

    // Deduct from vault
    vault.currentBalance -= amount;
    vault.totalCoinsDispatched += amount;
    vault.lastDispatchDate = new Date();
    vault.dispatchHistory.push({
      amount,
      targetSellerUid: sellerUid,
      dispatchedBy: req.user?.userId || 'OWNER',
      status: 'completed',
    });
    await vault.save();

    // Credit coins to seller's user account
    seller.coins = (seller.coins || 0) + amount;
    await seller.save();

    // Audit log
    await AuditLog.create({
      action: 'COIN_DISPATCH',
      performedBy: req.user?.userId || 'OWNER',
      details: `Dispatched ${amount} coins to seller UID: ${sellerUid}. Reason: ${reason || 'N/A'}`,
      metadata: { amount, sellerUid, sellerId: seller._id.toString(), vaultBalance: vault.currentBalance },
    });

    return res.status(200).json({
      success: true,
      message: `${amount} coins dispatched to seller ${sellerUid}. Seller new balance: ${seller.coins}`,
      data: {
        amount,
        sellerUid,
        sellerNewBalance: seller.coins,
        vaultBalance: vault.currentBalance,
      },
    });
  } catch (error) {
    console.error('dispatchToSeller Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/treasury/vault/burn
 * Owner only: burn coins from the vault
 */
exports.burnCoins = async (req, res) => {
  try {
    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive coin amount required' });
    }

    const vault = await CoinVault.getVault();
    if (vault.currentBalance < amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient vault balance. Available: ${vault.currentBalance}, Requested: ${amount}`,
      });
    }

    vault.currentBalance -= amount;
    vault.totalCoinsBurned += amount;
    vault.burnHistory.push({
      amount,
      reason: reason || 'Coin burn',
      burnedBy: req.user?.userId || 'OWNER',
    });
    await vault.save();

    await AuditLog.create({
      action: 'COIN_BURN',
      performedBy: req.user?.userId || 'OWNER',
      details: `Burned ${amount} coins. Reason: ${reason || 'N/A'}`,
      metadata: { amount, vaultBalance: vault.currentBalance },
    });

    return res.status(200).json({
      success: true,
      message: `${amount} coins burned. Vault balance: ${vault.currentBalance}`,
      data: { amount, currentBalance: vault.currentBalance },
    });
  } catch (error) {
    console.error('burnCoins Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * GET /api/treasury/vault/history
 * Get mint/dispatch/burn history with pagination
 */
exports.getVaultHistory = async (req, res) => {
  try {
    const type = req.query.type || 'all'; // 'mint' | 'dispatch' | 'burn' | 'all'
    const vault = await CoinVault.getVault();

    let history = [];
    if (type === 'mint' || type === 'all') {
      history = [
        ...history,
        ...vault.mintHistory.map((h) => ({ ...h.toObject(), historyType: 'mint' })),
      ];
    }
    if (type === 'dispatch' || type === 'all') {
      history = [
        ...history,
        ...vault.dispatchHistory.map((h) => ({ ...h.toObject(), historyType: 'dispatch' })),
      ];
    }
    if (type === 'burn' || type === 'all') {
      history = [
        ...history,
        ...vault.burnHistory.map((h) => ({ ...h.toObject(), historyType: 'burn' })),
      ];
    }

    // Sort by date descending
    history.sort((a, b) => new Date(b.mintedAt || b.dispatchedAt || b.burnedAt || b.createdAt || 0) - new Date(a.mintedAt || a.dispatchedAt || a.burnedAt || a.createdAt || 0));

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const total = history.length;
    const paginatedHistory = history.slice((page - 1) * limit, page * limit);

    return res.status(200).json({
      success: true,
      data: paginatedHistory,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('getVaultHistory Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};