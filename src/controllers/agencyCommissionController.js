// ═══════════════════════════════════════════════════════════════════════════
// CONTROLLER: AgencyCommissionController — Full commission tier management
// for host agencies with multi-level commission structures
// ═══════════════════════════════════════════════════════════════════════════

const Agency = require('../models/Agency');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const AuditLog = require('../models/AuditLog');

/**
 * POST /api/agency/commission-tiers/create
 * Create a new commission tier for an agency
 */
exports.createCommissionTier = async (req, res) => {
  try {
    const { agencyId, tierName, minEarnings, commissionPercent, bonusPercent, requirements } = req.body;

    if (!agencyId || !tierName || commissionPercent === undefined) {
      return res.status(400).json({ success: false, message: 'Agency ID, tier name, and commission percent required' });
    }

    const agency = await Agency.findById(agencyId);
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    if (!agency.commissionTiers) agency.commissionTiers = [];
    
    agency.commissionTiers.push({
      tierName,
      minEarnings: minEarnings || 0,
      commissionPercent,
      bonusPercent: bonusPercent || 0,
      requirements: requirements || '',
      isActive: true,
    });

    await agency.save();

    return res.status(201).json({
      success: true,
      message: `Commission tier '${tierName}' created for agency`,
      data: agency.commissionTiers,
    });
  } catch (error) {
    console.error('createCommissionTier Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * PUT /api/agency/commission-tiers/:agencyId/:tierIndex
 * Update a specific commission tier
 */
exports.updateCommissionTier = async (req, res) => {
  try {
    const { agencyId, tierIndex } = req.params;
    const idx = parseInt(tierIndex);
    const updates = req.body;

    const agency = await Agency.findById(agencyId);
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    if (!agency.commissionTiers || idx < 0 || idx >= agency.commissionTiers.length) {
      return res.status(400).json({ success: false, message: 'Invalid tier index' });
    }

    const tier = agency.commissionTiers[idx];
    if (updates.tierName !== undefined) tier.tierName = updates.tierName;
    if (updates.minEarnings !== undefined) tier.minEarnings = updates.minEarnings;
    if (updates.commissionPercent !== undefined) tier.commissionPercent = updates.commissionPercent;
    if (updates.bonusPercent !== undefined) tier.bonusPercent = updates.bonusPercent;
    if (updates.requirements !== undefined) tier.requirements = updates.requirements;
    if (updates.isActive !== undefined) tier.isActive = updates.isActive;

    await agency.save();

    return res.status(200).json({ success: true, message: 'Commission tier updated', data: agency.commissionTiers });
  } catch (error) {
    console.error('updateCommissionTier Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * DELETE /api/agency/commission-tiers/:agencyId/:tierIndex
 * Delete a commission tier
 */
exports.deleteCommissionTier = async (req, res) => {
  try {
    const { agencyId, tierIndex } = req.params;
    const idx = parseInt(tierIndex);

    const agency = await Agency.findById(agencyId);
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    if (!agency.commissionTiers || idx < 0 || idx >= agency.commissionTiers.length) {
      return res.status(400).json({ success: false, message: 'Invalid tier index' });
    }

    agency.commissionTiers.splice(idx, 1);
    await agency.save();

    return res.status(200).json({ success: true, message: 'Commission tier deleted', data: agency.commissionTiers });
  } catch (error) {
    console.error('deleteCommissionTier Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * GET /api/agency/commission-tiers/:agencyId
 * Get all commission tiers for an agency
 */
exports.getCommissionTiers = async (req, res) => {
  try {
    const agency = await Agency.findById(req.params.agencyId).select('commissionTiers name');
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }
    return res.status(200).json({ success: true, data: agency.commissionTiers || [] });
  } catch (error) {
    console.error('getCommissionTiers Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/agency/calculate-commission
 * Calculate commission for a host based on their agency's tier structure
 */
exports.calculateCommission = async (req, res) => {
  try {
    const { hostUid, earnings } = req.body;

    if (!hostUid || !earnings || earnings <= 0) {
      return res.status(400).json({ success: false, message: 'Host UID and positive earnings required' });
    }

    const host = await User.findOne({ uid: hostUid });
    if (!host) {
      return res.status(404).json({ success: false, message: 'Host not found' });
    }

    const agency = await Agency.findOne({ members: host._id });
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Host not affiliated with any agency' });
    }

    // Find applicable tier
    const tiers = agency.commissionTiers || [];
    let applicableTier = tiers.find((t) => earnings >= t.minEarnings && t.isActive);
    if (!applicableTier) {
      // Use lowest active tier as fallback
      applicableTier = tiers.filter((t) => t.isActive).sort((a, b) => a.minEarnings - b.minEarnings)[0];
    }

    if (!applicableTier) {
      return res.status(400).json({ success: false, message: 'No applicable commission tier found for this earnings amount' });
    }

    const commissionAmount = Math.floor(earnings * (applicableTier.commissionPercent / 100));
    const bonusAmount = Math.floor(commissionAmount * ((applicableTier.bonusPercent || 0) / 100));
    const totalCommission = commissionAmount + bonusAmount;

    return res.status(200).json({
      success: true,
      data: {
        hostUid,
        earnings,
        tier: applicableTier.tierName,
        commissionPercent: applicableTier.commissionPercent,
        bonusPercent: applicableTier.bonusPercent || 0,
        commissionAmount,
        bonusAmount,
        totalCommission,
        agencyName: agency.name,
      },
    });
  } catch (error) {
    console.error('calculateCommission Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};