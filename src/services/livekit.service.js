// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/services/livekit.service.js
// ARVIND PARTY - LIVEKIT SERVICE (Access Token Generation & Room Utilities)
// ═══════════════════════════════════════════════════════════════════════════
// Uses: livekit-server-sdk v2.x — AccessToken + VideoGrant
// Env:   LIVEKIT_API_KEY   - provided by Railway (required)
//        LIVEKIT_API_SECRET - provided by Railway (required)
//        LIVEKIT_WS_URL     - LiveKit WebSocket URL (optional fallback below)
//
// Generated token grants:
//   - join the specific room (roomJoin)
//   - publish audio / video tracks (canPublish)
//   - subscribe to remote participants (canSubscribe)
//   - send data channel messages (canPublishData)
// ═══════════════════════════════════════════════════════════════════════════

const { AccessToken, VideoGrant } = require('livekit-server-sdk');
const Room = require('../models/Room');

// ─────────────────────────────────────────────────────────────────────────
// ENVIRONMENT CONFIGURATION
// LIVEKIT_API_KEY and LIVEKIT_API_SECRET are set on Railway and injected
// at runtime via dotenv (server.js calls require('dotenv').config() first).
// ─────────────────────────────────────────────────────────────────────────
const LIVEKIT_API_KEY    = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_WS_URL     =
  process.env.LIVEKIT_WS_URL || 'wss://YOUR_LIVEKIT_DOMAIN';

// Default TTL applied when the caller does not override it.
const DEFAULT_TOKEN_TTL_S = 2 * 60 * 60; // 2 hours in seconds

// ─────────────────────────────────────────────────────────────────────────
// BOOT-TIME VALIDATION — warn once so operators know to fix the env
// ─────────────────────────────────────────────────────────────────────────
if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.warn(
    '[livekit.service] LIVEKIT_API_KEY and/or LIVEKIT_API_SECRET are not set. ' +
    'Token generation will fail until these env vars are populated via Railway.'
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Validate that a value is a non-empty string after trimming.
 * Used to sanitise all user-supplied fields before they reach the LiveKit SDK.
 * @param {*}    value - raw value to validate
 * @param {string} label - human-readable field name for log / error messages
 * @returns {string|null} trimmed string on success, null on failure
 */
const _requireNonEmptyString = (value, label) => {
  if (value === null || value === undefined) {
    console.error(`[livekit.service] Missing required parameter: ${label}.`);
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    console.error(`[livekit.service] Empty value not allowed for parameter: ${label}.`);
    return null;
  }
  return trimmed;
};

/**
 * Clamp a raw TTL value (seconds) to the safe range [60 s, 86 400 s].
 * Falls back to DEFAULT_TOKEN_TTL_S when the input is not parseable.
 * @param {*} raw - raw TTL value (number or numeric string)
 * @returns {number} clamped TTL in seconds
 */
const _resolveTtlSeconds = (raw) => {
  if (raw === null || raw === undefined || raw === '') {
    return DEFAULT_TOKEN_TTL_S;
  }
  const parsed = Number.parseInt(raw, 10);
  const ttl = Number.isFinite(parsed) ? parsed : DEFAULT_TOKEN_TTL_S;
  // Clamp to a reasonable range: 1 minute (60s) to 24 hours (86400s)
  return Math.max(60, Math.min(ttl, 86400));
};

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC SERVICE — LiveKitService
// ─────────────────────────────────────────────────────────────────────────

class LiveKitService {
  /**
   * Returns current credentials read from the environment.
   * @returns {{ apiKey: string|null, apiSecret: string|null, wsUrl: string }}
   */
  static getCredentials() {
    return {
      apiKey:    process.env.LIVEKIT_API_KEY    || null,
      apiSecret: process.env.LIVEKIT_API_SECRET || null,
      wsUrl:     LIVEKIT_WS_URL,
    };
  }

  /**
   * Whether the service has the minimum credentials required to operate.
   * @returns {boolean}
   */
  static isConfigured() {
    return Boolean(LIVEKIT_API_KEY && LIVEKIT_API_SECRET);
  }

  // ─────────────────────────────────────────────────────────────────────
  // ROOM NAME MAPPING
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Look up the LiveKit room name associated with an internal app room ID.
   * The `liveKitRoom` field is set on the Room document by the production
   * controller when a room is first created.
   * @param {string} roomId - internal application room identifier
   * @returns {Promise<string|null>} LiveKit room name or null if not found
   */
  static async getLiveKitRoomName(roomId) {
    if (!roomId) return null;
    try {
      // The roomName passed to generateAccessToken is our internal roomId.
      // We look it up to find the associated liveKitRoom name.
      const room = await Room.findById(roomId).select('liveKitRoom').lean();
      if (!room) {
        console.warn(`[livekit.service] No room found for internal roomId="${roomId}".`);
        return null;
      }
      return room.liveKitRoom;
    } catch (error) {
      console.error(`[livekit.service] DB error fetching LiveKit room name for roomId="${roomId}":`, error);
      return null;
    }
  }
  /**
   * Check whether a LiveKit room has active participants right now.
   * @param {string} roomName - LiveKit room name
   * @returns {Promise<boolean>}
   */
  static async hasActiveParticipants(roomName) {
    if (!roomName) return false;
    try {
      const { apiKey, apiSecret } = this.getCredentials();
      if (!apiKey || !apiSecret) return false;

      const lkRoom = await this.getLiveKitRoomName(roomName);
      const targetRoom = lkRoom || roomName;

      const sdkToken = new AccessToken(apiKey, apiSecret, {
        identity: '__system_checker__',
        ttl: '1m',
      });
      const grant = new VideoGrant().setRoomJoin(true).setRoom(targetRoom);
      sdkToken.addGrant(grant);
      const svcToken = await sdkToken.toJwt();

      const RoomServiceClient = require('livekit-server-sdk').RoomServiceClient;
      const svc = new RoomServiceClient(LIVEKIT_WS_URL, apiKey, apiSecret);
      const participants = await svc.listParticipants(targetRoom);
      return participants.length > 0;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // TOKEN GENERATION — PRIMARY PUBLIC API
  // Accepts a destructured options object so callers can pass individual
  // params or a single payload from a REST / socket handler.
  // ─────────────────────────────────────────────────────────────────────

  /**
   * @private
   * Helper to resolve and structure TTL values.
   * @param {*} rawTtl - The raw TTL value from the request.
   * @returns {{tokenTtl: number, tokenTtlSeconds: number}}
   */
  static _buildTtl(rawTtl) {
    const seconds = _resolveTtlSeconds(rawTtl);
    return {
      tokenTtl: seconds,
      tokenTtlSeconds: seconds,
    };
  }

  /**
   * Generate a signed LiveKit Access Token.
   *
   * Caller contract:
   *   body.roomName  → app roomId used to resolve the LiveKit room name
   *   body.identity  → unique user identity burned into the JWT
   *
   * Granted permissions:
   *   - Join the room          (roomJoin)
   *   - Publish audio/video    (canPublish)
   *   - Subscribe to streams   (canSubscribe)
   *   - Data channel messages  (canPublishData)
   *
   * Returns null on any error after logging to stderr.
   */
  static async generateAccessToken({
    roomName,
    identity,
    name = null,
    ttl,
    canPublish     = true,
    canSubscribe   = true,
    canPublishData = true,
  } = {}) {
    try {
      // ── 1. Guard: credentials ─────────────────────────────────────────
      if (!this.isConfigured()) {
        console.error(
          '[livekit.service] Cannot generate token: LIVEKIT_API_KEY and/or ' +
          'LIVEKIT_API_SECRET not set in process.env.'
        );
        return null;
      }

      // ── 2. Guard: required parameters ────────────────────────────────
      const trimmedRoom = _requireNonEmptyString(roomName, 'roomName');
      if (!trimmedRoom) return null;

      const trimmedIdentity = _requireNonEmptyString(identity, 'identity');
      if (!trimmedIdentity) return null;

      // ── 3. Resolve LiveKit room name from app roomId ────────────────
      const liveKitRoom = await this.getLiveKitRoomName(trimmedRoom);
      if (!liveKitRoom) {
        console.error(
          `[livekit.service] No LiveKit room mapped for app roomId="${trimmedRoom}". ` +
          'The room should have been created through the production controller ' +
          'which sets the liveKitRoom field on the Room document.'
        );
        return null;
      }

      // ── 4. Compute TTL ──────────────────────────────────────────────
      const { tokenTtl, tokenTtlSeconds } = this._buildTtl(ttl);

      // ── 5. Create and sign the AccessToken ──────────────────────────
      const { apiKey, apiSecret } = this.getCredentials();

      const accessToken = new AccessToken(apiKey, apiSecret, {
        identity: trimmedIdentity,
        name:     name || trimmedIdentity,
        ttl:      tokenTtl,
      });

      // ── 6. Attach VideoGrant with full AV permissions ───────────────
      //    This is the authoritative list of permissions a participant
      //    holds for the lifetime of this token.
      const videoGrant = new VideoGrant()
        .setRoom(liveKitRoom)        // scope: this specific room only
        .setRoomJoin(true)           // participant may enter the room
        .setCanPublish(canPublish)   // publish local audio + video
        .setCanSubscribe(canSubscribe) // receive remote audio + video
        .setCanPublishData(canPublishData); // data-channel messages

      accessToken.addGrant(videoGrant);

      // ── 7. Sign the JWT ──────────────────────────────────────────────
      const jwtToken = await accessToken.toJwt();

      // ── 8. Return a self-described response payload ──────────────────
      return {
        token:         jwtToken,
        liveKitRoom:   liveKitRoom,
        liveKitWsUrl:  LIVEKIT_WS_URL,
        identity:      trimmedIdentity,
        ttlSeconds:    tokenTtlSeconds,
        grantedAt:     new Date().toISOString(),
        permissions: {
          canPublish:     canPublish,
          canSubscribe:   canSubscribe,
          canPublishData: canPublishData,
        },
      };
    } catch (error) {
      console.error(
        `[livekit.service] Unhandled error in generateAccessToken ` +
        `(identity="${identity}", roomName="${roomName}"):`,
        error
      );
      return null;
    }
  }
