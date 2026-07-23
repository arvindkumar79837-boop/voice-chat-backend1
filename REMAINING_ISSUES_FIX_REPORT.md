# REMAINING ISSUES FIX REPORT — MASTER PROMPT #32

## Date: July 23, 2026
## Repository: voice-chat-backend1
## Commit: (pending push)

---

## Summary

Fixed 14 remaining issues across 3 severity tiers (HIGH, MEDIUM, LOW) covering database indexes, rate limiting, Redis consolidation, server lifecycle, and security hardening.

---

## HIGH-SEVERITY FIXES

### 1. DB Index — User.phone
- **File:** `src/models/User.js`
- **Line:** 170
- **Change:** Added `userSchema.index({ phone: 1 }, { sparse: true })`
- **Impact:** Queries filtering by phone number are now indexed; sparse index avoids null entries

### 2. DB Index — Family.family_name (text)
- **File:** `src/models/Family.js`
- **Line:** 58
- **Change:** Added `familySchema.index({ family_name: 'text' })`
- **Impact:** Full-text search on family names is now indexed for faster searchFamilies queries

### 3. DB Index — Gift.isActive
- **File:** `src/models/Gift.js`
- **Line:** 171
- **Change:** Added `giftSchema.index({ isActive: 1 })`
- **Impact:** Queries filtering by isActive are now indexed (getStoreGifts, getLuckyGifts)

### 4. Rate Limit — Refresh Token
- **File:** `src/routes/auth.routes.js`
- **Line:** 39
- **Change:** Added `authLimiter` middleware to `/refresh-token` route
- **Impact:** Prevents token refresh abuse; uses same 10 attempts/15 min limit as login

### 5. Rate Limit — Gift Send
- **File:** `src/routes/gift.routes.js`
- **Lines:** 14-20, 40
- **Change:** Added `express-rate-limit` with 30 requests/minute (100 in dev) on `/send` route
- **Impact:** Prevents gift-spam attacks and DDoS via gift endpoints

### 6. Rate Limit — Shop Purchase
- **File:** `src/routes/shopRoutes.js`
- **Lines:** 8-14, 19
- **Change:** Added `express-rate-limit` with 20 requests/minute (100 in dev) on `/purchase` route
- **Impact:** Prevents purchase abuse and race-condition exploitation

### 7. Rate Limit — Notifications
- **File:** `src/routes/notificationRoutes.js`
- **Lines:** 8-14, 17
- **Change:** Added `express-rate-limit` with 60 requests/minute (100 in dev) on `GET /` route
- **Impact:** Prevents notification-fetch abuse

### 8. Redis Consolidation — otp.service.js
- **File:** `src/services/otp.service.js`
- **Lines:** 7-59 (full initRedis replacement)
- **Change:** Replaced independent `redis.createClient()` with shared `getRedisClient()` from `config/redis.js`. Memory fallback preserved.
- **Impact:** Eliminates 2nd Redis connection; OTP service uses shared client

### 9. Redis Consolidation — jwt.js
- **File:** `src/utils/jwt.js`
- **Lines:** 9-18
- **Change:** Replaced lazy `redis.createClient()` with shared `getRedisClient()` from `config/redis.js`
- **Impact:** Eliminates 3rd Redis connection; token blacklisting uses shared client

### 10. Redis Consolidation — familySocket.js
- **File:** `src/sockets/familySocket.js`
- **Lines:** 1-9 (imports), all `redis.*` calls → `getRedis().*`
- **Change:** Replaced `ioredis` import + `new Redis()` with shared `getRedisClient()` from `config/redis.js`. Converted `redis.set(key, val, 'EX', sec)` to `redis.set(key, val, { EX: sec })` for v4 API compatibility.
- **Impact:** Eliminates 4th Redis connection; family socket uses shared client. Removed `ioredis` dependency.

### 11. Server Shutdown — Redis Disconnect Fix
- **File:** `server.js`
- **Lines:** 368-374
- **Change:** Fixed broken `connectRedis.quit()` (was calling function, not client) → `disconnectRedis()` from `config/redis.js`
- **Impact:** Graceful shutdown now properly closes the shared Redis connection

### 12. Server Startup — Removed duplicate Redis init
- **File:** `server.js`
- **Line:** 44
- **Change:** Added `disconnectRedis` to destructured import; removed duplicate Redis connection attempt
- **Impact:** Server no longer creates 2 separate Redis connections on startup

### 13. DB Fail-Fast
- **File:** `src/config/db.js`
- **Line:** 22-23
- **Change:** Replaced `return false` (fail-open) with `process.exit(1)` (fail-fast)
- **Impact:** Server now crashes on DB connection failure instead of running in degraded mode with fallback data

### 14. DB Fail-Fast in server.js
- **File:** `server.js`
- **Lines:** 159-163
- **Change:** Added `process.exit(1)` catch block for MongoDB connection failure
- **Impact:** Server exits immediately if MongoDB is unavailable

---

## MEDIUM-SEVERITY FIXES

### MED-1. Trust Proxy
- **File:** `src/app.js`
- **Line:** 91 (after `const app = express()`)
- **Change:** Added `app.set('trust proxy', 1)` for correct client IP detection behind load balancers
- **Impact:** Rate limiting and security middleware now correctly identify client IPs

### MED-2. Shop Purchase Atomicity
- **File:** `src/controllers/shop.controller.js`
- **Lines:** 14-45
- **Change:** Replaced find→check→save pattern with single `User.findOneAndUpdate()` using `$inc: { diamonds: -price }` and `$push: { inventory: ... }` atomically
- **Impact:** Eliminates race condition where 2 concurrent purchases could both pass balance check

### MED-3. Creator Withdrawal → 501
- **File:** `src/controllers/creatorController.js`
- **Lines:** 41-47
- **Change:** Replaced fake `res.json({ success: true })` with `res.status(501).json({ message: 'Withdrawal not yet implemented' })`
- **Impact:** Client now knows withdrawal is not implemented instead of receiving false success

### MED-4. Stay Reward Race Condition
- **File:** `src/sockets/familySocket.js`
- **Lines:** 214-239
- **Change:** Replaced `session.save()` + `user.save()` + `family.save()` with three atomic `findOneAndUpdate()` operations using `$inc` for coins, xp, familyContribution, totalWealth, total_xp
- **Impact:** Eliminates race condition where 2 simultaneous reward claims could double-credit the user

### MED-5. Regex Injection — familyController.js
- **File:** `src/controllers/familyController.js`
- **Lines:** 306, 340, 372 (3 functions: searchFamilies, searchUsersByUid, searchUsersToInvite)
- **Change:** Added `.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` to escape special regex characters before constructing RegExp
- **Impact:** Prevents ReDoS attacks via crafted search queries

### MED-6. Regex Injection — admin.controller.js
- **File:** `src/controllers/admin.controller.js`
- **Lines:** 82-87, 204-208
- **Change:** Added regex escaping to search parameters in getUsers and getWallets
- **Impact:** Prevents ReDoS attacks in admin search endpoints

### MED-7. Regex Injection — admin.user.controller.js
- **File:** `src/controllers/admin.user.controller.js`
- **Lines:** 15-19
- **Change:** Added regex escaping to search parameter in getAllUsers
- **Impact:** Prevents ReDoS in admin user search

### MED-8. Regex Injection — reportController.js
- **File:** `src/controllers/reportController.js`
- **Lines:** 24-25
- **Change:** Added regex escaping to search parameter in buildReportQuery
- **Impact:** Prevents ReDoS in report search

### MED-9. Regex Injection — room.production.controller.js
- **File:** `src/controllers/room.production.controller.js`
- **Lines:** 151-157
- **Change:** Added regex escaping to search parameter in getRooms
- **Impact:** Prevents ReDoS in room search

### MED-10. Mass-Assignment Whitelist
- **File:** `src/controllers/admin.controller.js`
- **Lines:** 131-136
- **Change:** Added whitelist of allowed fields (`name, email, phone, avatar, bio, level, xp, coins, diamonds, role, isBanned, isActive, isVip, vipLevel, kyc.status`). Only whitelisted fields are applied via `$set`.
- **Impact:** Prevents admin from accidentally setting `uid`, `password`, `familyId`, or other sensitive fields

---

## LOW-SEVERITY FIXES

### LOW-1. EventSocket JWT Consolidation
- **File:** `src/sockets/eventSocket.js`
- **Lines:** 1, 17-28
- **Change:** Removed direct `jwt.verify()` call; now uses `verifyAccessToken()` from `src/utils/jwt.js` (same shared middleware used by all other endpoints)
- **Impact:** Eliminates duplicate JWT verification logic; single source of truth for token verification

### LOW-2. Matchmaking Missing roomId
- **File:** `src/sockets/matchmakingSocket.js`
- **Lines:** 6-7, 23-24
- **Change:** Added `crypto` import and `roomId: ROOM_${Date.now()}_${randomBytes}` to Room creation
- **Impact:** Room creation no longer fails due to missing required `roomId` field

### LOW-3. Firebase Consolidation
- **File:** `src/config/firebase.js`
- **Lines:** 1-20 (full rewrite)
- **Change:** Replaced independent Firebase initialization with re-export from `firebase-admin.js`
- **Impact:** Single Firebase initialization; no duplicate SDK init attempts

---

## Files Modified (21 files)

| File | Changes |
|------|---------|
| `src/models/User.js` | Added phone index |
| `src/models/Family.js` | Added family_name text index |
| `src/models/Gift.js` | Added isActive index |
| `src/routes/auth.routes.js` | Added authLimiter to /refresh-token |
| `src/routes/gift.routes.js` | Added express-rate-limit to /send |
| `src/routes/shopRoutes.js` | Added express-rate-limit to /purchase |
| `src/routes/notificationRoutes.js` | Added express-rate-limit to GET / |
| `src/services/otp.service.js` | Consolidated Redis to shared client |
| `src/utils/jwt.js` | Consolidated Redis to shared client |
| `src/sockets/familySocket.js` | Replaced ioredis with shared Redis; atomic $inc for rewards |
| `src/sockets/eventSocket.js` | Removed duplicate JWT; uses shared middleware |
| `src/sockets/matchmakingSocket.js` | Added roomId to Room creation |
| `src/controllers/shop.controller.js` | Atomic findOneAndUpdate |
| `src/controllers/creatorController.js` | Withdrawal → 501 |
| `src/controllers/familyController.js` | Regex escaping (3 functions) |
| `src/controllers/admin.controller.js` | Mass-assignment whitelist + regex escaping |
| `src/controllers/admin.user.controller.js` | Regex escaping |
| `src/controllers/reportController.js` | Regex escaping |
| `src/controllers/room.production.controller.js` | Regex escaping |
| `src/config/db.js` | Fail-fast on connection failure |
| `src/config/firebase.js` | Consolidated with firebase-admin.js |
| `server.js` | Fixed Redis disconnect; removed duplicate init; added DB fail-fast |
| `src/app.js` | Added trust proxy |

---

## Verification Checklist

- [ ] All 3 Redis connections consolidated to shared `config/redis.js` client
- [ ] No more `ioredis` dependency in familySocket.js
- [ ] Rate limits on all mutating endpoints
- [ ] DB indexes for phone, family_name, isActive
- [ ] Graceful shutdown properly closes Redis via `disconnectRedis()`
- [ ] Shop purchase is atomic (no race condition)
- [ ] Stay rewards use atomic `$inc` operations
- [ ] All search inputs escaped before RegExp construction
- [ ] Admin user update only applies whitelisted fields
- [ ] Server fails fast on DB connection failure
- [ ] EventSocket uses shared JWT verification
- [ ] Matchmaking rooms always have roomId
- [ ] Firebase initialization consolidated to single source

---

*Report generated: July 23, 2026*
