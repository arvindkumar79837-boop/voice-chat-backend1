const Logger = require('../utils/logger');
const RechargePlan = require('../models/RechargePlan');
const AuditLog = require('../models/AuditLog');

exports.listPlans = async (req, res) => {
  try {
    const plans = await RechargePlan.find({ isActive: true })
      .sort({ displayOrder: 1, priceINR: 1 });
    return res.status(200).json({ success: true, data: plans });
  } catch (error) {
    Logger.error('List Recharge Plans Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.listAllPlans = async (req, res) => {
  try {
    const plans = await RechargePlan.find()
      .sort({ displayOrder: 1, priceINR: 1 });
    return res.status(200).json({ success: true, data: plans });
  } catch (error) {
    Logger.error('List All Recharge Plans Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.createPlan = async (req, res) => {
  try {
    const { priceINR, coinsAwarded, displayOrder, label, tagColor } = req.body;

    if (!priceINR || !coinsAwarded) {
      return res.status(400).json({ success: false, message: 'priceINR and coinsAwarded required' });
    }

    const plan = new RechargePlan({
      priceINR,
      coinsAwarded,
      displayOrder: displayOrder || 0,
      label: label || '',
      tagColor: tagColor || '#FF9800',
      createdBy: req.user?.userId || null,
    });
    await plan.save();

    await AuditLog.create({
      action: 'RECHARGE_PLAN_CREATED',
      performedBy: req.user?.userId || 'OWNER',
      details: `Created recharge plan: ₹${priceINR} = ${coinsAwarded} coins`,
      metadata: { planId: plan._id, priceINR, coinsAwarded },
    });

    return res.status(201).json({ success: true, message: 'Plan created', data: plan });
  } catch (error) {
    Logger.error('Create Recharge Plan Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { priceINR, coinsAwarded, isActive, displayOrder, label, tagColor } = req.body;

    const plan = await RechargePlan.findById(id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    if (priceINR !== undefined) plan.priceINR = priceINR;
    if (coinsAwarded !== undefined) plan.coinsAwarded = coinsAwarded;
    if (isActive !== undefined) plan.isActive = isActive;
    if (displayOrder !== undefined) plan.displayOrder = displayOrder;
    if (label !== undefined) plan.label = label;
    if (tagColor !== undefined) plan.tagColor = tagColor;

    await plan.save();

    await AuditLog.create({
      action: 'RECHARGE_PLAN_UPDATED',
      performedBy: req.user?.userId || 'OWNER',
      details: `Updated plan ${id}: ₹${plan.priceINR} = ${plan.coinsAwarded} coins`,
      metadata: { planId: id, changes: Object.keys(req.body) },
    });

    return res.status(200).json({ success: true, message: 'Plan updated', data: plan });
  } catch (error) {
    Logger.error('Update Recharge Plan Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await RechargePlan.findByIdAndDelete(id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    await AuditLog.create({
      action: 'RECHARGE_PLAN_DELETED',
      performedBy: req.user?.userId || 'OWNER',
      details: `Deleted recharge plan: ₹${plan.priceINR} = ${plan.coinsAwarded} coins`,
      metadata: { planId: id },
    });

    return res.status(200).json({ success: true, message: 'Plan deleted' });
  } catch (error) {
    Logger.error('Delete Recharge Plan Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
