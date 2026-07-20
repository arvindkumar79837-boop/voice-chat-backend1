const LegalDocument = require('../models/LegalDocument');
const Staff = require('../models/Staff');
const User = require('../models/User');
const AccountDeletionRequest = require('../models/AccountDeletionRequest');
const AuditLog = require('../models/AuditLog');

exports.getDocument = async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['PRIVACY_POLICY', 'TERMS_OF_SERVICE', 'COMMUNITY_GUIDELINES'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: `Invalid type. Must be: ${validTypes.join(', ')}` });
    }
    const doc = await LegalDocument.findOne({ type, isActive: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    return res.json({ success: true, data: doc });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllDocuments = async (req, res) => {
  try {
    const docs = await LegalDocument.find({}).sort({ type: 1 });
    return res.json({ success: true, data: docs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.upsertDocument = async (req, res) => {
  try {
    const { type, title, content } = req.body;
    const updatedBy = req.user?.id || req.user?.userId;
    const validTypes = ['PRIVACY_POLICY', 'TERMS_OF_SERVICE', 'COMMUNITY_GUIDELINES'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: `Invalid type. Must be: ${validTypes.join(', ')}` });
    }
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'title and content required' });
    }

    const doc = await LegalDocument.findOneAndUpdate(
      { type },
      { title, content, lastUpdatedBy: updatedBy, isActive: true },
      { upsert: true, new: true }
    );

    await AuditLog.create({
      action: 'LEGAL_DOCUMENT_UPDATED',
      executorId: updatedBy,
      reason: `Updated ${type}: ${title}`,
      metadata: { type, docId: doc._id },
    });

    return res.json({ success: true, message: 'Document saved', data: doc });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.acceptDocument = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { type } = req.body;
    const validTypes = ['PRIVACY_POLICY', 'TERMS_OF_SERVICE', 'COMMUNITY_GUIDELINES'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid document type' });
    }

    const fieldMap = {
      PRIVACY_POLICY: 'privacyPolicyAcceptedAt',
      TERMS_OF_SERVICE: 'termsAcceptedAt',
    };
    const field = fieldMap[type];
    if (field) {
      await User.findByIdAndUpdate(userId, { [field]: new Date() });
    }

    return res.json({ success: true, message: `${type} accepted` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.requestDeletion = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const existing = await AccountDeletionRequest.findOne({ userId, status: 'PENDING' });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Deletion already pending', data: existing });
    }

    const scheduledDeletionAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const request = await AccountDeletionRequest.create({
      userId: user._id,
      uid: user.uid,
      scheduledDeletionAt,
      reason: req.body.reason || '',
    });

    await AuditLog.create({
      action: 'ACCOUNT_DELETION_REQUESTED',
      executorId: userId,
      reason: `Scheduled deletion in 30 days`,
      metadata: { requestId: request._id, scheduledAt: scheduledDeletionAt },
    });

    return res.json({
      success: true,
      message: `Account deletion scheduled. You can cancel within 30 days.`,
      data: { scheduledDeletionAt, cancelUrl: '/api/legal/cancel-deletion' },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.cancelDeletion = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const request = await AccountDeletionRequest.findOne({ userId, status: 'PENDING' });
    if (!request) return res.status(404).json({ success: false, message: 'No pending deletion found' });

    request.status = 'CANCELLED';
    await request.save();

    await AuditLog.create({
      action: 'ACCOUNT_DELETION_CANCELLED',
      executorId: userId,
      reason: 'User cancelled account deletion',
    });

    return res.json({ success: true, message: 'Account deletion cancelled' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.processExpiredDeletions = async () => {
  try {
    const now = new Date();
    const expired = await AccountDeletionRequest.find({ status: 'PENDING', scheduledDeletionAt: { $lte: now } });
    let processed = 0;
    for (const req of expired) {
      await User.findOneAndUpdate(
        { _id: req.userId },
        {
          $set: {
            isActive: false,
            isBanned: true,
            banReason: 'Account deleted by user request',
            bannedAt: now,
          },
          $unset: {
            phone: '', email: '', avatar: '', bio: '', displayName: '', name: '',
            socialLinks: '', gallery: '', blockList: '',
          },
        }
      );
      req.status = 'COMPLETED';
      req.completedAt = now;
      await req.save();
      processed++;
    }
    return processed;
  } catch (err) {
    console.error('Error processing expired deletions:', err);
    return 0;
  }
};
