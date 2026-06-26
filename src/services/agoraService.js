// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/services/agoraService.js
// ARVIND PARTY - AGORA SERVICE (Token Generation)
// ═══════════════════════════════════════════════════════════════════════════

const Agora = require('agora-access-token');

class AgoraService {
  /**
   * Generate Agora RTC token for voice/video calling
   * @param {Object} options
   * @param {string} options.appId - Agora App ID
   * @param {string} options.appCertificate - Agora App Certificate
   * @param {string} options.channelName - Channel name for the call
   * @param {number} options.uid - User ID (0 for dynamic assignment)
   * @param {string} options.role - 'publisher' or 'audience'
   * @param {number} options.expireTime - Token expiration time in seconds (default: 3600)
   * @returns {string} RTC token
   */
  static generateToken({
    appId,
    appCertificate,
    channelName,
    uid,
    role = 'audience',
    expireTime = 3600,
  }) {
    if (!appId || !appCertificate) {
      throw new Error('Agora App ID and Certificate are required');
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const expirationTimeInSeconds = currentTime + expireTime;

    // Build token
    let token;
    if (role === 'publisher') {
      token = Agora.RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        uid,
        Agora.RtcRole.PUBLISHER,
        expirationTimeInSeconds
      );
    } else {
      token = Agora.RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        uid,
        Agora.RtcRole.SUBSCRIBER,
        expirationTimeInSeconds
      );
    }

    return token;
  }

  /**
   * Generate Agora RTM token for messaging
   * @param {string} appId - Agora App ID
   * @param {string} appCertificate - Agora App Certificate
   * @param {string} userId - User ID
   * @param {number} expireTime - Token expiration time in seconds
   * @returns {string} RTM token
   */
  static generateRtmToken(appId, appCertificate, userId, expireTime = 3600) {
    if (!appId || !appCertificate) {
      throw new Error('Agora App ID and Certificate are required');
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const expirationTimeInSeconds = currentTime + expireTime;

    return Agora.RtmTokenBuilder.buildToken(
      appId,
      appCertificate,
      userId,
      expirationTimeInSeconds
    );
  }

  /**
   * Validate Agora token
   * @param {string} token - Token to validate
   * @returns {boolean} Whether token is valid
   */
  static validateToken(token) {
    // Agora tokens are validated on the Agora servers
    // This is a placeholder for custom validation logic if needed
    return token && token.length > 0;
  }

  /**
   * Get channel metadata for a room
   * @param {string} roomId - Room ID
   * @returns {Object} Channel metadata
   */
  static getChannelMetadata(roomId) {
    return {
      channelName: `room_${roomId}`,
      feature: {
        level: 0, // 0: No restrictions, 1: Live, 2: Interactive streaming
      },
    };
  }
}

module.exports = AgoraService;