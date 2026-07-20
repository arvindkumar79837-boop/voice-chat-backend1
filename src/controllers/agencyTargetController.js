const AgencyTarget = require('../models/AgencyTarget');
const Agency = require('../models/Agency');
const AuditLog = require('../models/AuditLog');

exports.createTarget = async (req, res) => {
  try {
    const { agencyId, targetType, targetAmount, durationType, durationDays, rewardType, rewardValue, notes } = req.body;

    if (!agencyId || !targetType || !targetAmount || !durationType) {
      return res.status(400).json({ success: false, message: 'agencyId, targetType, targetAmount, durationType required' });
    }

    const agency = await Agency.findById(agencyId);
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    const now = new Date();
    let days = durationDays;
    if (durationType === 'WEEKLY') days = 7;
    else if (durationType === 'MONTHLY') days = 30;
    else if (!days) days = 7;

    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const target = new AgencyTarget({
      agencyId,
      targetType,
      targetAmount,
      durationType,
      durationDays: days,
      startDate: now,
      endDate,
      rewardType: rewardType || 'coins',
      rewardValue: rewardValue || null,
      createdBy: req.user?.userId || 'OWNER',
      notes: notes || '',
    });
    await target.save();

    await AuditLog.create({
      action: 'AGENCY_TARGET_CREATED',
      performedBy: req.user?.userId || 'OWNER',
      details: `Created target for agency ${agency.name}: ${targetType} ${targetAmount} in ${days} days`,
      metadata: { targetId: target._id, agencyId, targetType, targetAmount, days },
    });

    return res.status(201).json({ success: true, message: 'Target created', data: target });
  } catch (error) {
    console.error('Create Agency Target Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.listTargets = async (req, res) => {
  try {
    const { status, agencyId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (agencyId) filter.agencyId = agencyId;

    const targets = await AgencyTarget.find(filter)
      .populate('agencyId', 'name ownerUid')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: targets });
  } catch (error) {
    console.error('List Agency Targets Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.updateTarget = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetAmount, endDate, status, rewardType, rewardValue, notes } = req.body;

    const target = await AgencyTarget.findById(id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Target not found' });
    }

    if (targetAmount !== undefined) target.targetAmount = targetAmount;
    if (endDate !== undefined) target.endDate = new Date(endDate);
    if (status !== undefined) target.status = status;
    if (rewardType !== undefined) target.rewardType = rewardType;
    if (rewardValue !== undefined) target.rewardValue = rewardValue;
    if (notes !== undefined) target.notes = notes;

    await target.save();

    await AuditLog.create({
      action: 'AGENCY_TARGET_UPDATED',
      performedBy: req.user?.userId || 'OWNER',
      details: `Updated target ${id}`,
      metadata: { targetId: id, changes: Object.keys(req.body) },
    });

    return res.status(200).json({ success: true, message: 'Target updated', data: target });
  } catch (error) {
    console.error('Update Agency Target Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getAgencyDashboard = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const agency = await Agency.findById(agencyId);
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    const activeTarget = await AgencyTarget.findOne({ agencyId, status: 'ACTIVE' })
      .sort({ createdAt: -1 });

    const pastTargets = await AgencyTarget.find({ agencyId, status: { $in: ['COMPLETED', 'FAILED', 'EXPIRED'] } })
      .sort({ createdAt: -1 })
      .limit(10);

    let daysRemaining = 0;
    let percentComplete = 0;
    if (activeTarget) {
      const now = new Date();
      daysRemaining = Math.max(0, Math.ceil((activeTarget.endDate - now) / (1000 * 60 * 60 * 24)));
      percentComplete = Math.min(100, (activeTarget.currentProgress / activeTarget.targetAmount) * 100);
    }

    return res.status(200).json({
      success: true,
      data: {
        agency: { _id: agency._id, name: agency.name, ownerUid: agency.ownerUid },
        activeTarget: activeTarget ? {
          ...activeTarget.toObject(),
          percentComplete: Math.round(percentComplete * 100) / 100,
          daysRemaining,
        } : null,
        pastTargets,
        stats: {
          totalTargets: pastTargets.length + (activeTarget ? 1 : 0),
          completed: pastTargets.filter(t => t.status === 'COMPLETED').length,
          failed: pastTargets.filter(t => t.status === 'FAILED').length,
        },
      },
    });
  } catch (error) {
    console.error('Agency Dashboard Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.updateProgress = async (agencyId, amount, metricType) => {
  try {
    const target = await AgencyTarget.findOne({ agencyId, status: 'ACTIVE' });
    if (!target) return;

    if (metricType === 'COINS_SPENT' && target.targetType === 'COINS_SPENT') {
      target.currentProgress += amount;
    } else if (metricType === 'REVENUE_USD' && target.targetType === 'REVENUE_USD') {
      target.currentProgress += amount;
    }

    if (target.currentProgress >= target.targetAmount) {
      target.status = 'COMPLETED';
    }

    await target.save();
  } catch (error) {
    console.error('Update Agency Target Progress Error:', error);
  }
};

exports.checkExpiredTargets = async () => {
  try {
    const now = new Date();
    const expired = await AgencyTarget.find({ status: 'ACTIVE', endDate: { $lte: now } });

    for (const target of expired) {
      if (target.currentProgress >= target.targetAmount) {
        target.status = 'COMPLETED';
      } else {
        target.status = 'FAILED';
      }
      await target.save();

      await AuditLog.create({
        action: 'AGENCY_TARGET_EXPIRED',
        performedBy: 'SYSTEM',
        details: `Target ${target._id} expired. Status: ${target.status}. Progress: ${target.currentProgress}/${target.targetAmount}`,
        metadata: { targetId: target._id, agencyId: target.agencyId, status: target.status },
      });
    }

    return expired.length;
  } catch (error) {
    console.error('Check Expired Targets Error:', error);
    return 0;
  }
};
