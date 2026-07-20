# 🏰 MASTER PROMPT #11 — Luxury / Premium Features Report

**Date:** 2026-07-19  
**Repository:** voice-chat-backend1  
**Commit scope:** Premium Subscriptions, Room Lock, Music/Karaoke Broadcast, Room Discovery, Min Withdrawal Threshold, Moment moderation fix

---

## 1. Recurring Premium Subscription (Yalla/Bigo-level)

### New Model: `PremiumSubscription`
- **Tiers:** Silver / Gold / Royal (enum-locked)
- **Pricing:** `priceINR`, `durationDays` (30/90/365)
- **Perks:**
  - `monthlyCoins` — free coins credited every 28 days
  - `badgeIcon` — exclusive badge shown on profile
  - `entranceEffectId` — animated VIP entrance effect in rooms
  - `animatedStickerPackId` — premium sticker pack
  - `friendLimitBoost` — extra friend slots
  - `levelUpMultiplier` — XP multiplier (1x–5x)
  - `exclusiveNameCardId` — luxury name card
  - `luxuryVehicleEffectId` — animated car effect on room entry
- `googlePlayProductId` — mapped to Google Play recurring in-app product

### New APIs (`/api/subscriptions`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/tiers` | Owner | Create subscription tier |
| PUT | `/tiers/:tierId` | Owner | Update tier perks/pricing |
| DELETE | `/tiers/:tierId` | Owner | Delete tier (blocks if active users exist) |
| GET | `/tiers` | Public | List all active tiers |
| GET | `/tiers/:tierId` | Public | Get tier details |
| POST | `/verify-play-subscription` | User | Verify Google Play receipt + activate |
| POST | `/claim-monthly-coins` | User | Claim 28-day monthly coins (rate-limited) |
| GET | `/my-subscription` | User | Get current subscription status |

### User Model Update
- Added `activeSubscription: { tierId, expiresAt }` field to User schema

### Cron Job
- Runs daily at midnight (`0 0 * * *`)
- Deactivates expired subscriptions on both User and Staff models
- Monthly coins only claimable once per 28 days (not automatically credited)

---

## 2. Room Lock (Paid Private Room)

### Room Model Update
- `isLocked: Boolean` — whether room is currently locked
- `lockPinHash: String` — bcrypt-hashed PIN (never stored in plaintext)
- `lockExpiresAt: Date` — auto-unlock when expired
- `lockPurchasedBy: ObjectId` — who paid for the lock

### SystemSettings
| Key | Default | Description |
|-----|---------|-------------|
| `room_lock_cost` | 50 | Coins deducted to lock room |
| `room_lock_duration_hours` | 6 | Default lock duration |

### New APIs (`/api/luxury`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/rooms/:roomId/lock` | Owner | Lock room (deducts coins, stores hashed PIN) |
| POST | `/rooms/:roomId/unlock-attempt` | Public | Verify PIN to join locked room |
| POST | `/rooms/:roomId/unlock` | Owner | Manually remove lock early |

### Security
- PIN hashed with `bcryptjs` (10 rounds)
- Lock auto-expires via `lockExpiresAt` field
- Only room owner can lock/unlock

---

## 3. Karaoke + Music Broadcast

### Room Model Update
- `currentTrack: { title, url, startedAt, startedBy, isPlaying, lyricsUrl }` — real-time playback state

### REST APIs (`/api/luxury`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/rooms/:roomId/music/play` | Host/Co-host | Start track |
| POST | `/rooms/:roomId/music/pause` | Host/Co-host | Pause track |
| POST | `/rooms/:roomId/music/stop` | Host/Co-host | Stop and clear track |
| GET | `/rooms/:roomId/music/current` | Public | Get current track state |

### Socket Events (in `/room-features` namespace)
| Event | Sender | Broadcast | Description |
|-------|--------|-----------|-------------|
| `music:play` | Host | `music:sync` → all room members | Play track, sync timestamp |
| `music:pause` | Host | `music:sync` → all room members | Pause track |
| `music:stop` | Host | `music:sync` → all room members | Stop track |
| `music:request-sync` | Late joiner | `music:sync` → requester | Get current state |

### Sync Protocol
- Server broadcasts `serverTimestamp: Date.now()` with every `music:sync` event
- Clients calculate playback offset: `localNow - serverTimestamp + track.startedAt`
- Late joiners emit `music:request-sync` to catch up

### Lyrics Support
- `lyricsUrl` field on `currentTrack` — accepts LRC format URLs
- Client-side rendering handles LRC parsing and timed display

---

## 4. Room Discovery — Country/Topic Filters

### Room Model Update
- `country: String` — room's country code (e.g. "IN", "US", "AE")

### New API (`/api/luxury`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/discover` | Public | Filter rooms by country, topic, roomType with pagination |

**Query params:** `country`, `topic`, `roomType`, `page` (default 1), `limit` (default 20)

**Response:** Paginated room list sorted by: isLive → activeUsers → createdAt

---

## 5. Minimum Withdrawal Threshold (Already Existed)

The `diamond_withdrawal_min` setting already existed in SystemSettings (default: 50 diamonds) and was already validated in `diamondWithdrawalController.requestWithdrawal`. No changes needed.

---

## 6. Moment Model Fix (Moderation + Field Alignment)

### Moment Schema Update
- Added `mediaUrls: [String]` — controller was writing this but schema only had `images`
- Added `mediaType: String` — controller accepted but schema had no field
- Added `text: String` in comments — controller pushed `{userId, text}` but schema had `{userId, userName, content}`
- Added `moderationStatus: String` — CLEAN/FLAGGED/REMOVED
- Added `moderationFlagCount: Number` — tracks report count
- Added `topic: String` + `country: String` — for filtered feed queries
- Added text index on `content` for full-text search

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/models/PremiumSubscription.js` | NEW | Subscription tier model |
| `src/controllers/premiumSubscriptionController.js` | NEW | Tier CRUD + Play verify + monthly coins |
| `src/routes/premiumSubscriptionRoutes.js` | NEW | 8 endpoints |
| `src/models/User.js` | EDITED | Added `activeSubscription` field |
| `src/models/Room.js` | EDITED | Added lock, music, country fields |
| `src/models/SystemSettings.js` | EDITED | Added room_lock_cost, room_lock_duration_hours |
| `src/models/Moment.js` | EDITED | Fixed field mismatches + moderation fields |
| `src/controllers/roomLockController.js` | NEW | Lock/unlock + discovery endpoints |
| `src/controllers/musicBroadcastController.js` | NEW | Play/pause/stop/current track |
| `src/routes/roomLuxuryRoutes.js` | NEW | 9 endpoints for lock + music + discovery |
| `src/sockets/roomFeaturesSocket.js` | EDITED | Added music:play/pause/stop/sync events |
| `server.js` | EDITED | Added daily subscription expiry cron |
| `src/app.js` | EDITED | Mounted 2 new route groups |
