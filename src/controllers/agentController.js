const mongoose = require('mongoose');
const User = require('../models/User');
const Agency = require('../models/Agency');
const Agent = require('../models/Agent');
const AuditLog = require('../models/AuditLog');

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: ADD NEW AGENT (RECRUITER)
// POST /api/agency/agents/add
// ─────────────────────────────────────────────────────────────────────────
exports.addAgent = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { uid, commissionRate } = req.body;

    if (!uid) return res.status(400).json({ success: false, message: 'Agent UID is required' });

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });
    if (agency.owner.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only agency owner can add agents' });
    }

    const agentUser = await User.findOne({ uid });
    if (!agentUser) return res.status(404).json({ success: false, message: 'User not found with this UID' });
    if (!agency.hosts.includes(agentUser._id)) {
      return res.status(400).json({ success: false, message: 'User must be a host in the agency first' });
    }

    const existing = await Agent.findOne({ agencyId: agency._id, uid });
    if (existing) return res.status(400).json({ success: false, message: 'Agent already exists' });

    const agent = await Agent.create({
      agencyId: agency._id,
      recruiterId: agentUser._id,
      uid: agentUser.uid,
      name: agentUser.name,
      avatar: agentUser.avatar,
      commissionRate: commissionRate || 5,
    });

    res.status(201).json({ success: true, agent, message: 'Agent added successfully' });
  } catch (error) {
    console.error('Add Agent Error:', error);
    res.status(500).json({ success: false, message: 'Failed to add agent' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: LIST ALL AGENTS
// GET /api/agency/agents
// ─────────────────────────────────────────────────────────────────────────
exports.listAgents = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    const agents = await Agent.find({ agencyId: agency._id })
      .populate('recruiterId', 'name avatar arvindId')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: agents, count: agents.length });
  } catch (error) {
    console.error('List Agents Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch agents' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: UPDATE AGENT COMMISSION RATE
// PUT /api/agency/agents/:agentId
// ─────────────────────────────────────────────────────────────────────────
exports.updateAgent = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { agentId } = req.params;
    const { commissionRate, isActive } = req.body;

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });
    if (agency.owner.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only agency owner can update agents' });
    }

    const agent = await Agent.findOne({ _id: agentId, agencyId: agency._id });
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });

    if (commissionRate !== undefined) agent.commissionRate = commissionRate;
    if (isActive !== undefined) agent.isActive = isActive;
    await agent.save();

    res.status(200).json({ success: true, agent, message: 'Agent updated' });
  } catch (error) {
    console.error('Update Agent Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update agent' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: REMOVE AGENT
// DELETE /api/agency/agents/:agentId
// ─────────────────────────────────────────────────────────────────────────
exports.deleteAgent = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { agentId } = req.params;

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });
    if (agency.owner.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only agency owner can remove agents' });
    }

    const agent = await Agent.findOneAndDelete({ _id: agentId, agencyId: agency._id });
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });

    res.status(200).json({ success: true, message: 'Agent removed successfully' });
  } catch (error) {
    console.error('Delete Agent Error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove agent' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: GET AGENT PERFORMANCE
// GET /api/agency/agents/:agentId/performance
// ─────────────────────────────────────────────────────────────────────────
exports.getAgentPerformance = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { agentId } = req.params;

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    const agent = await Agent.findOne({ _id: agentId, agencyId: agency._id }).populate('recruiterId', 'name avatar arvindId');
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });

    const recruitedHosts = await User.find({ referredBy: agent.recruiterId?._id, agencyId: agency._id })
      .select('name avatar arvindId createdAt');

    const performance = {
      ...agent.toObject(),
      recruitedHosts,
      totalEarningsGenerated: agent.totalEarningsGenerated || 0,
      commissionRate: agent.commissionRate || 5,
    };

    res.status(200).json({ success: true, data: performance });
  } catch (error) {
    console.error('Agent Performance Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch agent performance' });
  }
};

module.exports = {};