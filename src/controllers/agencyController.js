const User = require('../models/User');
const Agency = require('../models/Agency');
const redisRankingIntegration = require('../services/redisRankingIntegration');

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

    // Initialize agency in Redis rankings
    redisRankingIntegration.onAgencyDiamondEarned(agency._id, 0).catch(err => console.error('Redis agency init failed:', err.message));

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

    const agency = await Agency.findById(agencyId);
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    if (agency.hosts.includes(userId)) {
      return res.status(400).json({ success: false, message: 'Already a member of this agency' });
    }

    const existingRequest = await HostRequest.findOne({ agencyId, userId });
    if (existingRequest && existingRequest.status === 'pending') {
      return res.status(400).json({ success: false, message: 'Request already pending' });
    }

    const hostRequest = await HostRequest.create({
      agencyId,
      userId,
      status: 'approved',
      requestedBy: userId,
      applicationMessage: '',
      reviewedBy: agency.owner,
      reviewedAt: new Date(),
      reviewNotes: 'Auto-approved via apply flow',
    });

    agency.hosts.push(userId);
    agency.totalHosts = agency.hosts.length;
    await agency.save();

    await User.findByIdAndUpdate(userId, { agencyId: agency._id, role: 'host' });

    // Update agency ranking
    redisRankingIntegration.onAgencyDiamondEarned(agency._id, 0).catch(err => console.error('Redis agency join failed:', err.message));

    res.status(200).json({ success: true, agency, message: 'Joined agency successfully' });
  } catch (error) {
    console.error('Apply Agency Error:', error);
    res.status(500).json({ success: false, message: 'Failed to apply to agency' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: SEND HOST REQUEST TO USER BY UID
// POST /api/agency/hosts/request
// ─────────────────────────────────────────────────────────────────────────
exports.sendHostRequest = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { targetUid, message } = req.body;

    if (!targetUid) return res.status(400).json({ success: false, message: 'Target UID is required' });

    const agency = await Agency.findOne({ owner: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    const targetUser = await User.findOne({ uid: targetUid });
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found with this UID' });

    if (agency.hosts.includes(targetUser._id)) {
      return res.status(400).json({ success: false, message: 'User is already a host in your agency' });
    }

    const existing = await HostRequest.findOne({ agencyId: agency._id, userId: targetUser._id });
    if (existing && existing.status === 'pending') {
      return res.status(400).json({ success: false, message: 'Request already pending for this user' });
    }

    const hostRequest = await HostRequest.create({
      agencyId: agency._id,
      userId: targetUser._id,
      status: 'pending',
      requestedBy: userId,
      applicationMessage: message || '',
    });

    res.status(201).json({ success: true, hostRequest, message: 'Host request sent' });
  } catch (error) {
    console.error('Send Host Request Error:', error);
    res.status(500).json({ success: false, message: 'Failed to send host request' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: LIST PENDING HOST REQUESTS
// GET /api/agency/hosts/requests
// ─────────────────────────────────────────────────────────────────────────
exports.getHostRequests = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const agency = await Agency.findOne({ owner: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    const requests = await HostRequest.find({ agencyId: agency._id, status: 'pending' })
      .populate('userId', 'name avatar arvindId uid')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: requests, count: requests.length });
  } catch (error) {
    console.error('Get Host Requests Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch host requests' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: APPROVE HOST REQUEST
// POST /api/agency/hosts/approve/:requestId
// ─────────────────────────────────────────────────────────────────────────
exports.approveHostRequest = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { requestId } = req.params;
    const { reviewNotes } = req.body;

    const agency = await Agency.findOne({ owner: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    const request = await HostRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.agencyId.toString() !== agency._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Request already processed' });

    request.status = 'approved';
    request.reviewedBy = userId;
    request.reviewedAt = new Date();
    request.reviewNotes = reviewNotes || '';
    await request.save();

    if (!agency.hosts.includes(request.userId)) {
      agency.hosts.push(request.userId);
      agency.totalHosts = agency.hosts.length;
      await agency.save();
    }

    await User.findByIdAndUpdate(request.userId, { agencyId: agency._id, role: 'host' });

    // Update agency ranking with new host
    redisRankingIntegration.onAgencyDiamondEarned(agency._id, 0).catch(err => console.error('Redis agency host add failed:', err.message));

    res.status(200).json({ success: true, message: 'Host request approved' });
  } catch (error) {
    console.error('Approve Host Request Error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve request' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: REJECT HOST REQUEST
// POST /api/agency/hosts/reject/:requestId
// ─────────────────────────────────────────────────────────────────────────
exports.rejectHostRequest = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { requestId } = req.params;
    const { reviewNotes } = req.body;

    const agency = await Agency.findOne({ owner: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    const request = await HostRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.agencyId.toString() !== agency._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Request already processed' });

    request.status = 'rejected';
    request.reviewedBy = userId;
    request.reviewedAt = new Date();
    request.reviewNotes = reviewNotes || '';
    await request.save();

    res.status(200).json({ success: true, message: 'Host request rejected' });
  } catch (error) {
    console.error('Reject Host Request Error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject request' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: REMOVE HOST FROM AGENCY
// POST /api/agency/hosts/remove/:hostId
// ─────────────────────────────────────────────────────────────────────────
exports.removeHost = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { hostId } = req.params;

    const agency = await Agency.findOne({ owner: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    if (agency.owner.toString() === hostId) {
      return res.status(400).json({ success: false, message: 'Cannot remove agency owner' });
    }

    agency.hosts = agency.hosts.filter(h => h.toString() !== hostId);
    agency.totalHosts = agency.hosts.length;
    await agency.save();

    await User.findByIdAndUpdate(hostId, { $unset: { agencyId: 1 }, role: 'user' });

    // Update agency ranking after host removal
    redisRankingIntegration.onAgencyDiamondEarned(agency._id, 0).catch(err => console.error('Redis agency host remove failed:', err.message));

    res.status(200).json({ success: true, message: 'Host removed from agency' });
  } catch (error) {
    console.error('Remove Host Error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove host' });
  }
};
