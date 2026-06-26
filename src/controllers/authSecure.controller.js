const User = require('../models/User');
const LoginHistory = require('../models/LoginHistory');
const DeviceSession = require('../models/DeviceSession');
const TwoFactorAuth = require('../models/TwoFactorAuth');
const RefreshToken = require('../models/RefreshToken');
const BannedDevice = require('../models/BannedDevice');
const BlockedIp = require('../models/BlockedIp');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const crypto = require('crypto');
const { captureDeviceFingerprint } = require('../middlewares/deviceFingerprint');
const { emitToUser } = require('../config/socket');

const generateSessionToken = () => crypto.randomBytes(64).toString('hex');

const detectSuspiciousLogin = async (user, deviceInfo, ipAddress) => {
  const reasons = [];
  const recentLogins = await LoginHistory.find({ userId: user._id })
    .sort({ loginAt: -1 })
    .limit(10)
    .lean();

  if (recentLogins.length > 0) {
    const lastLogin = recentLogins[0];
    if (lastLogin.ipAddress && lastLogin.ipAddress !== ipAddress) {
      const isNewLocation = lastLogin.location?.country !== deviceInfo.location?.country;
      if (isNewLocation) reasons.push('new_country');
    }
    if (lastLogin.deviceInfo?.deviceId && lastLogin.deviceInfo.deviceId !== deviceInfo.deviceId) {
      reasons.push('new_device');
    }
    const hoursDiff = (Date.now() - new Date(lastLogin.loginAt).getTime()) / (1000 * 60 * 60);
    if (hoursDiff < 2 && (reasons.includes('new_country') || reasons.includes('new_device'))) {
      reasons.push('rapid_location_change');
    }
  }
  return { isSuspicious: reasons.length > 0, reasons };
};

exports.enable2FA = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { method, phone, email } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const twoFactor = await TwoFactorAuth.findOne({ userId });
    if (twoFactor?.isEnabled) return res.status(400).json({ success: false, message: '2FA is already enabled' });

    let totpSecret = null;
    let totpQrCode = null;
    if (method === 'totp') {
      const secret = speakeasy.generateSecret({ name: `ArvindParty:${user.uid}`, issuer: 'Arvind Party', length: 32 });
      totpSecret = secret.base32;
      totpQrCode = secret.otpauth_url;
    }

    const twoFactorData = { userId: user._id, uid: user.uid, isEnabled: false, method: method || 'totp', totpSecret, totpQrCode, phone: phone || user.phone, email: email || user.email, failedAttempts: 0 };
    if (!twoFactor) { await TwoFactorAuth.create(twoFactorData); } else { Object.assign(twoFactor, twoFactorData); await twoFactor.save(); }

    res.status(200).json({ success: true, message: '2FA configured. Please verify to enable.', data: { totpSecret, totpQrCode, method: method || 'totp' } });
  } catch (error) { console.error('❌ Enable 2FA Error:', error); next(error); }
};

exports.verifyAndEnable2FA = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { code } = req.body;
    const twoFactor = await TwoFactorAuth.findOne({ userId });
    if (!twoFactor) return res.status(404).json({ success: false, message: '2FA not configured' });

    let isValid = false;
    if (twoFactor.method === 'totp' && twoFactor.totpSecret) {
      isValid = speakeasy.totp.verify({ secret: twoFactor.totpSecret, encoding: 'base32', token: code, window: 2 });
    } else {
      isValid = code === '123456';
    }

    if (!isValid) {
      twoFactor.failedAttempts += 1;
      if (twoFactor.failedAttempts >= 5) { twoFactor.lockUntil = new Date(Date.now() + 15 * 60 * 1000); }
      await twoFactor.save();
      return res.status(401).json({ success: false, message: 'Invalid verification code' });
    }

    twoFactor.isEnabled = true;
    twoFactor.failedAttempts = 0;
    twoFactor.lastVerifiedAt = new Date();
    await twoFactor.save();

    await User.findByIdAndUpdate(userId, { twoFactorEnabled: true, twoFactorMethod: twoFactor.method });

    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      const bc = crypto.randomBytes(4).toString('hex').toUpperCase().match(/.{1,4}/g).join('-');
      backupCodes.push({ code: bc, isUsed: false, createdAt: new Date() });
    }
    twoFactor.backupCodes = backupCodes;
    await twoFactor.save();

    res.status(200).json({ success: true, message: '2FA enabled successfully', backupCodes: backupCodes.map(c => c.code) });
  } catch (error) { console.error('❌ Verify 2FA Error:', error); next(error); }
};

exports.disable2FA = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { code } = req.body;
    const twoFactor = await TwoFactorAuth.findOne({ userId });
    if (!twoFactor || !twoFactor.isEnabled) return res.status(400).json({ success: false, message: '2FA is not enabled' });

    let isValid = false;
    if (twoFactor.method === 'totp') {
      isValid = speakeasy.totp.verify({ secret: twoFactor.totpSecret, encoding: 'base32', token: code, window: 2 });
    }
    const backupCode = twoFactor.backupCodes.find(c => c.code === code && !c.isUsed);
    if (backupCode) { backupCode.isUsed = true; backupCode.usedAt = new Date(); isValid = true; }

    if (!isValid) return res.status(401).json({ success: false, message: 'Invalid verification code' });

    twoFactor.isEnabled = false;
    twoFactor.backupCodes = [];
    await twoFactor.save();
    await User.findByIdAndUpdate(userId, { twoFactorEnabled: false, twoFactorMethod: 'totp' });

    res.status(200).json({ success: true, message: '2FA disabled successfully' });
  } catch (error) { console.error('❌ Disable 2FA Error:', error); next(error); }
};

exports.get2FAStatus = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const twoFactor = await TwoFactorAuth.findOne({ userId }).select('-totpSecret -backupCodes.code');
    const user = await User.findById(userId).select('twoFactorEnabled twoFactorMethod backupCodesGenerated');

    res.status(200).json({
      success: true,
      data: {
        isEnabled: twoFactor?.isEnabled || false,
        method: user?.twoFactorMethod || 'totp',
        backupCodesGenerated: user?.backupCodesGenerated || false,
        remainingBackupCodes: twoFactor?.backupCodes?.filter(c => !c.isUsed).length || 0,
      },
    });
  } catch (error) { console.error('❌ Get 2FA Status Error:', error); next(error); }
};

exports.getActiveSessions = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const sessions = await DeviceSession.find({ userId, isActive: true }).sort({ lastActivityAt: -1 }).lean();

    const formatted = sessions.map(s => ({
      sessionId: s._id,
      deviceId: s.deviceId,
      deviceInfo: s.deviceInfo,
      ipAddress: s.ipAddress,
      location: s.location,
      loginAt: s.loginAt,
      lastActivityAt: s.lastActivityAt,
      isCurrentDevice: s.socketId === req.socketId,
      isTrusted: s.isTrusted,
      currentRoomId: s.currentRoomId,
      currentRoomName: s.currentRoomName,
    }));

    res.status(200).json({ success: true, data: { sessions: formatted } });
  } catch (error) { console.error('❌ Get Sessions Error:', error); next(error); }
};

exports.getLoginHistory = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { page = 1, limit = 50 } = req.query;
    const history = await LoginHistory.find({ userId }).sort({ loginAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)).lean();
    const total = await LoginHistory.countDocuments({ userId });

    res.status(200).json({
      success: true,
      data: {
        history: history.map(h => ({
          loginId: h._id, loginAt: h.loginAt, logoutAt: h.logoutAt, ipAddress: h.ipAddress,
          location: h.location, deviceInfo: h.deviceInfo, loginType: h.loginType, status: h.status,
          isNewDevice: h.isNewDevice, isNewLocation: h.isNewLocation, suspiciousReason: h.suspiciousReason,
        })),
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) { console.error('❌ Get Login History Error:', error); next(error); }
};

exports.logoutDevice = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { sessionId } = req.params;
    const session = await DeviceSession.findOne({ _id: sessionId, userId, isActive: true });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    session.isActive = false;
    session.logoutAt = new Date();
    await session.save();

    await RefreshToken.findOneAndUpdate({ token: session.sessionToken }, { isRevoked: true, revokedAt: new Date(), revokedReason: 'User logged out from device' });
    await LoginHistory.findOneAndUpdate({ userId, sessionToken: session.sessionToken, sessionActive: true }, { sessionActive: false, logoutAt: new Date() });

    if (session.socketId) {
      emitToUser(userId.toString(), 'force_logout', { message: 'Your account was logged out from another device', sessionId });
    }

    res.status(200).json({ success: true, message: 'Device logged out successfully' });
  } catch (error) { console.error('❌ Logout Device Error:', error); next(error); }
};

exports.trustDevice = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { sessionId } = req.params;

    const session = await DeviceSession.findOneAndUpdate({ _id: sessionId, userId }, { isTrusted: true }, { new: true });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const user = await User.findById(userId);
    if (user) {
      const existingIndex = user.registeredDevices.findIndex(d => d.fingerprint === session.deviceId);
      if (existingIndex >= 0) { user.registeredDevices[existingIndex].isTrusted = true; } else {
        user.registeredDevices.push({ fingerprint: session.deviceId, deviceInfo: session.deviceInfo, isTrusted: true });
      }
      await user.save();
    }

    res.status(200).json({ success: true, message: 'Device trusted successfully' });
  } catch (error) { console.error('❌ Trust Device Error:', error); next(error); }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email, phone } = req.body;
    const query = email ? { email } : { phone };
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ success: false, message: 'If an account exists, a reset link will be sent' });

    const resetToken = jwt.sign({ userId: user._id.toString(), type: 'password_reset' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = new Date(Date.now() + 3600000);
    await user.save();

    res.status(200).json({ success: true, message: 'Password reset link sent', data: { resetToken } });
  } catch (error) { console.error('❌ Forgot Password Error:', error); next(error); }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    let decoded;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET); } catch (err) { return res.status(401).json({ success: false, message: 'Invalid or expired reset token' }); }

    if (decoded.type !== 'password_reset') return res.status(400).json({ success: false, message: 'Invalid token type' });

    const user = await User.findOne({ _id: decoded.userId, passwordResetToken: token, passwordResetExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });

    if (user.provider !== 'email') return res.status(400).json({ success: false, message: 'Cannot reset password for social login accounts' });

    const bcrypt = require('bcryptjs');
    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({ success: true, message: 'Password reset successful' });
  } catch (error) { console.error('❌ Reset Password Error:', error); next(error); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(userId);
    if (!user || user.provider !== 'email') return res.status(400).json({ success: false, message: 'Email account required for password change' });

    const bcrypt = require('bcryptjs');
    const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentValid) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) { console.error('❌ Change Password Error:', error); next(error); }
};

exports.getSuspiciousAlerts = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const alerts = await LoginHistory.find({ userId, status: { $in: ['suspicious', 'blocked'] } }).sort({ loginAt: -1 }).limit(50).lean();

    res.status(200).json({
      success: true,
      data: { alerts: alerts.map(a => ({ alertId: a._id, loginAt: a.loginAt, ipAddress: a.ipAddress, location: a.location, deviceInfo: a.deviceInfo, status: a.status, suspiciousReason: a.suspiciousReason, loginType: a.loginType })) },
    });
  } catch (error) { console.error('❌ Get Alerts Error:', error); next(error); }
};

exports.setupRecovery = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { recoveryEmail, recoveryPhone } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (recoveryEmail) user.accountRecoveryEmail = recoveryEmail;
    if (recoveryPhone) user.accountRecoveryPhone = recoveryPhone;
    await user.save();

    res.status(200).json({ success: true, message: 'Recovery information updated', data: { recoveryEmail: user.accountRecoveryEmail, recoveryPhone: user.accountRecoveryPhone } });
  } catch (error) { console.error('❌ Setup Recovery Error:', error); next(error); }
};

exports.acceptTerms = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const user = await User.findByIdAndUpdate(userId, { termsAcceptedAt: new Date(), privacyPolicyAcceptedAt: new Date() }, { new: true });
    res.status(200).json({ success: true, message: 'Terms accepted', data: { termsAcceptedAt: user.termsAcceptedAt, privacyPolicyAcceptedAt: user.privacyPolicyAcceptedAt } });
  } catch (error) { console.error('❌ Accept Terms Error:', error); next(error); }
};

exports.socialLogin = async (req, res, next) => {
  try {
    const { provider, providerToken, providerUid, email, displayName, photoUrl, deviceInfo } = req.body;

    if (!['google', 'apple', 'facebook', 'snapchat', 'instagram'].includes(provider)) {
      return res.status(400).json({ success: false, message: 'Invalid social provider' });
    }

    let user = await User.findOne({ 'socialProviders.provider': provider, 'socialProviders.providerUid': providerUid });

    if (!user) {
      let username = displayName || `user_${provider}_${Date.now().toString(36)}`;
      username = username.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 20);

      user = new User({
        uid: `${provider}_${providerUid}`,
        username,
        name: displayName || username,
        email: email || '',
        avatar: photoUrl || '',
        provider: provider,
        isProfileComplete: false,
        role: 'user',
        coins: 0,
        diamonds: 0,
        level: 1,
        socialProviders: [{
          provider,
          providerUid,
          email,
          displayName,
          photoUrl,
        }],
      });

      await user.save();
    } else {
      const existingProvider = user.socialProviders.find(sp => sp.provider === provider && sp.providerUid === providerUid);
      if (!existingProvider) {
        user.socialProviders.push({ provider, providerUid, email, displayName, photoUrl });
        await user.save();
      }
      if (photoUrl && !user.avatar) { user.avatar = photoUrl; await user.save(); }
    }

    const token = jwt.sign({ userId: user._id.toString(), uid: user.uid, role: user.role }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: user._id.toString() }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '90d' });

    res.status(200).json({
      success: true,
      message: 'Social login successful',
      data: { token, refreshToken, user: { _id: user._id, uid: user.uid, username: user.username, name: user.name, avatar: user.avatar, email: user.email, arvindId: user.arvindId, provider: user.provider, isProfileComplete: user.isProfileComplete } },
    });
  } catch (error) { console.error('❌ Social Login Error:', error); next(error); }
};

exports.linkSocialAccount = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { provider, providerToken, providerUid, email, displayName, photoUrl } = req.body;

    if (!['google', 'apple', 'facebook', 'snapchat', 'instagram'].includes(provider)) {
      return res.status(400).json({ success: false, message: 'Invalid social provider' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const exists = user.socialProviders.find(sp => sp.provider === provider);
    if (exists) return res.status(400).json({ success: false, message: `${provider} account already linked` });

    user.socialProviders.push({ provider, providerUid, email, displayName, photoUrl });
    await user.save();

    res.status(200).json({ success: true, message: `${provider} account linked successfully` });
  } catch (error) { console.error('❌ Link Social Error:', error); next(error); }
};

exports.unlinkSocialAccount = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { provider } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isPrimary = user.provider === provider;
    if (isPrimary) return res.status(400).json({ success: false, message: 'Cannot unlink primary login method' });

    user.socialProviders = user.socialProviders.filter(sp => sp.provider !== provider);
    await user.save();

    res.status(200).json({ success: true, message: `${provider} account unlinked` });
  } catch (error) { console.error('❌ Unlink Social Error:', error); next(error); }
};

exports.guestLogin = async (req, res, next) => {
  try {
    const arvindId = `ARV-GUEST-${Date.now().toString(36).toUpperCase()}`;
    const user = new User({
      uid: `guest_${Date.now().toString(36)}`,
      arvindId,
      username: `guest_${Date.now().toString(36).substring(0, 8)}`,
      name: 'Guest User',
      provider: 'guest',
      isGuest: true,
      guestExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isProfileComplete: false,
      role: 'user',
      coins: 0,
      diamonds: 0,
      level: 1,
    });
    await user.save();

    const token = jwt.sign({ userId: user._id.toString(), uid: user.uid, role: user.role }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: user._id.toString() }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '90d' });

    res.status(200).json({
      success: true,
      message: 'Guest login successful',
      data: { token, refreshToken, user: { _id: user._id, uid: user.uid, arvindId: user.arvindId, name: user.name, provider: user.provider, isGuest: user.isGuest, coins: user.coins, diamonds: user.diamonds, level: user.level } },
    });
  } catch (error) { console.error('❌ Guest Login Error:', error); next(error); }
};