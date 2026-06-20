const User = require('../models/User');
const Agency = require('../models/Agency');

// ─────────────────────────────────────────────────────────────────────────
// GET CURRENT USER'S AGENCY
// GET /api/agency
// ─────────────────────────────────────────────────────────────────────────
exports.getMyAgency = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const agency = await Agency.findOne({ hosts: userId }).populate('owner', 'name avatar');
    if (agency) {
      res.status(200).json({ success: true, agency, message: "Agency data loaded" });
    } else {
      res.status(200).json({ success: true, agency: null, message: "Not part of an agency" });
    }
  } catch (error) {
    console.error('Get Agency Error:', error);
    res.status(500).json({ success: false, message: 'Failed to load agency data' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// CREATE AGENCY
// POST /api/agency/create
// ─────────────────────────────────────────────────────────────────────────
exports.createAgency = async (req, res) => {
  try {
    const { name, description, logo } = req.body;
    const userId = req.user.id || req.user.userId;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Agency name is required' });
    }

    // Check if user already owns an agency
    const existing = await Agency.findOne({ owner: userId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You already own an agency' });
    }

    const agency = await Agency.create({
      name,
      owner: userId,
      ownerUid: req.user.uid || userId.toString(),
      description: description || '',
      logo: logo || '',
      hosts: [userId],
      totalHosts: 1,
    });

    const populated = await Agency.findById(agency._id).populate('owner', 'name avatar');

    res.status(201).json({
      success: true,
      agency: populated,
      message: 'Agency created successfully'
    });
  } catch (error) {
    console.error('Create Agency Error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Agency name already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to create agency' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// LIST AGENCY HOSTS/MEMBERS
// GET /api/agency/hosts
// ─────────────────────────────────────────────────────────────────────────
exports.listHosts = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const agency = await Agency.findOne({ hosts: userId })
      .populate('hosts', 'name avatar arvindId coins diamonds');

    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    const hosts = agency.hosts.map(host => {
      if (typeof host === 'object' && host !== null) {
        return {
          _id: host._id,
          name: host.name,
          avatar: host.avatar,
          arvindId: host.arvindId,
          earnings: host.coins || 0,
          role: host._id.toString() === agency.owner.toString() ? 'owner' : 'host'
        };
      }
      return host;
    });

    res.status(200).json({
      success: true,
      data: hosts,
      count: hosts.length
    });
  } catch (error) {
    console.error('List Hosts Error:', error);
    res.status(500).json({ success: false, message: 'Failed to list agency hosts' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET AGENCY EARNINGS
// GET /api/agency/earnings
// ─────────────────────────────────────────────────────────────────────────
exports.getEarnings = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const agency = await Agency.findOne({ hosts: userId });

    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    const totalEarnings = agency.earnings || 0;
    const totalHosts = agency.totalHosts || agency.hosts.length;

    res.status(200).json({
      success: true,
      data: {
        agencyId: agency._id,
        agencyName: agency.name,
        totalEarnings,
        totalHosts,
        commissionRate: 0.1, // 10% commission
        thisMonthEarnings: Math.floor(totalEarnings * 0.3), // ~30% this month estimate
        lastMonthEarnings: Math.floor(totalEarnings * 0.2),  // ~20% last month estimate
        currency: 'diamonds'
      }
    });
  } catch (error) {
    console.error('Get Earnings Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch agency earnings' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// APPLY / JOIN AGENCY
// POST /api/agency/apply
// ─────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────
// ADMIN: LIST ALL AGENCIES
// GET /api/admin/agencies
// ─────────────────────────────────────────────────────────────────────────
exports.getAgencies = async (req, res) => {
  try {
    const agencies = await Agency.find()
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, data: agencies });
  } catch (error) {
    console.error('Get Agencies Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch agencies' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// ADMIN: APPROVE AGENCY
// POST /api/admin/agencies/approve/:id
// ─────────────────────────────────────────────────────────────────────────
exports.approveAgency = async (req, res) => {
  try {
    const { id } = req.params;
    const agency = await Agency.findByIdAndUpdate(id, { isApproved: true, status: 'active' }, { new: true });
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }
    return res.status(200).json({ success: true, message: 'Agency approved successfully', agency });
  } catch (error) {
    console.error('Approve Agency Error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve agency' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// ADMIN: REVOKE AGENCY
// POST /api/admin/agencies/revoke/:id
// ─────────────────────────────────────────────────────────────────────────
exports.revokeAgency = async (req, res) => {
  try {
    const { id } = req.params;
    const agency = await Agency.findByIdAndUpdate(id, { isApproved: false, status: 'revoked' }, { new: true });
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }
    return res.status(200).json({ success: true, message: 'Agency revoked successfully', agency });
  } catch (error) {
    console.error('Revoke Agency Error:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke agency' });
  }
};

exports.applyForAgency = async (req, res) => {
  try {
    const { agencyId } = req.body;
    const userId = req.user.id || req.user.userId;

    const agency = await Agency.findByIdAndUpdate(
      agencyId,
      { $addToSet: { hosts: userId }, $inc: { totalHosts: 1 } },
      { new: true }
    );
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }
    res.status(200).json({ success: true, agency, message: 'Application approved and joined agency' });
  } catch (error) {
    console.error('Apply Agency Error:', error);
    res.status(500).json({ success: false, message: 'Failed to apply to agency' });
  }
};
