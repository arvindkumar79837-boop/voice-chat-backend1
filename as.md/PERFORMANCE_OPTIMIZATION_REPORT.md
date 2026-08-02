# Performance Optimization Audit Report — Arvind Party Backend

**Date**: 2025-07-31  
**Scope**: Indexes, pagination, N+1 queries, aggregation, cache/Redis, compression, memory/CPU  
**Total Files Audited**: 60+ models, controllers, services, configs

---

## Executive Summary

The codebase has **strong index coverage** (242 index definitions across models) and **consistent pagination** using `skip/limit`. However, there are **critical N+1 query risks** in controllers that `populate` inside loops, **unbounded aggregation pipelines** that return full collections, **no response compression** on JSON APIs, and **memory-heavy patterns** like loading all online users into memory for hourly aggregation. Redis ranking is well-structured but batch initialization lacks pipelining.

| Category | Status |
|---|---|
| Indexes | 🟢 Comprehensive coverage; a few missing compound indexes |
| Pagination | 🟢 Consistent `skip/limit` with `page/limit` params |
| N+1 Query | 🟡 Several controllers populate in loops; risk of 1000+ DB calls |
| Aggregation | 🟡 Mostly unbounded; some missing `$facet` for parallel stats |
| Cache / Redis | 🟢 Ranking TTL 24h; OTP TTL 5min; no HTTP response cache |
| Compression | 🔴 None — no gzip/brotli middleware |
| Memory | 🟡 Hourly aggregation loads all online users; OTP fallback map unbounded |
| CPU | 🟡 PowerMatrix validation runs 4 parallel DB queries per socket event |

---

## 1. Indexes

Observations:
- **242 index definitions** found across `src/models/*.js`.
- Strong compound indexes on `User` (`agencyId + isActive`, `familyId + isActive`), `Room` (`status + isActive + isLive + activeUsers`), `WalletTransaction` (`userId + createdAt`), `GiftEvent` (`roomId + createdAt`, `senderId + createdAt`, `receiverId + createdAt`).
- Good unique indexes: `SalaryRecord` (`userId + month + year`), `FamilyLeaderboard` (`familyId + uid + period`), `RoomFollower` (`roomId + userId`).
- **TTL indexes**: `BlockedIp` (`expiresAt`), `TwoFactorSession` (`expiresAt`), `InviteEvent` (`expires_at`), `RefreshToken` (`expiresAt`), `SpamLog` (`createdAt`).

**Gaps**:
- `FamilyChatMessage` has `familyId + createdAt` but no `familyId + senderUid + createdAt` compound for message list queries with author filter.
- `UserEventProgress` has `userId + eventId + taskId` unique, but queries by `eventId + is_completed` could use `eventId + is_completed + createdAt`.
- `AgencyWallet` has no index on `agencyId` (should be unique and indexed — it is unique but no explicit index shown).
- `DealerWallet` indexes on `level` and `isFlagged` but not on `uid + isActive` for frequent lookups during transfer.

**Recommendation**:
- Add `FamilyChatMessage` compound index: `{ familyId: 1, senderUid: 1, createdAt: -1 }`.
- Add `UserEventProgress` compound index: `{ eventId: 1, is_completed: 1, createdAt: -1 }`.
- Add `DealerWallet` compound index: `{ uid: 1, isActive: 1 }`.

---

## 2. Pagination

Observations:
- **Consistent pattern**: `page = parseInt(req.query.page, 10) || 1`, `limit = parseInt(req.query.limit, 10) || 50`, `skip = (page - 1) * limit`.
- Used extensively in controllers: `admin.user.controller.js`, `admin.controller.js`, `familyController.js`, `walletController.js`, `eventController.js`, `tournamentController.js`, `notificationController.js`, `blindDateController.js`, `championshipController.js`, `dealerController.js`, `rewardInjectorController.js`, `webViewGameController.js`, `localizationController.js`, `inviteEventController.js`, `security.controller.js`, `moduleManagerController.js`, `roomFeaturesController.js`, `singingController.js`, `treasureHuntController.js`, `targetManagerController.js`, `roomLockController.js`, `powerMatrixController.js`, `contentModerationController.js`, `moderationController.js`, `vipSystemController.js`, `reportController.js`.
- **No cursor-based pagination** anywhere. `skip/limit` on large offsets (e.g., page 1000) causes MongoDB to walk the index, which is O(n).

**Recommendation**:
- For high-traffic list endpoints (`/api/rooms/live`, `/api/admin/users`, `/api/wallet/transactions`), implement **cursor-based pagination** using `_id` or `createdAt` as cursor.
- Cap `limit` max to 100 to prevent abuse.

---

## 3. N+1 Query

Severity breakdown:

| Severity | Location | Issue |
|---|---|---|
| 🔴 HIGH | `familyController.js:1635-1667` | `updateLeaderboard` loads all members, then runs `Promise.all` of `FamilyLeaderboard.findOneAndUpdate` per member. With 100 members, this is 100 sequential upserts. Should use bulkWrite. |
| 🔴 HIGH | `familyController.js:2086-2115` | `updateLeaderboardForMember` loads all leaderboard entries for a family, then updates each rank one-by-one with `findOneAndUpdate`. O(n) queries per call. |
| 🟡 MEDIUM | `gift.production.controller.js` | Likely populates `giftId` inside loops for gift history; not fully audited but pattern is common. |
| 🟡 MEDIUM | `room.production.controller.js` | `getLiveRooms` may populate multiple refs per room; if not using `.populate()` on array, could loop. |
| 🟢 OK | `dealerController.js` | Uses session transactions and bulk operations where appropriate. |
| 🟢 OK | `salaryController.js` | Batch `find` then `Promise.all` for updates; acceptable. |

**Recommendation**:
- Replace per-member `findOneAndUpdate` loops with `bulkWrite([ { updateOne: { filter, update } }, ... ])`.
- In `updateLeaderboardForMember`, compute rank array in memory and issue single `updateMany` with positional `$inc` or accept eventual consistency.

---

## 4. Aggregation

Observations:
- **Light use of aggregation**: mostly `find().sort().skip().limit()`.
- Aggregations found:
  - `adminController.js` — revenue analytics with `$match`, `$group`.
  - `moduleManagerController.js` — `Transaction.aggregate` for stats.
  - `webViewGameController.js` — game ledger `$group`.
  - `reportsController.js` — salary + gift analytics `$group`.
  - `coinVaultController.js` — vault history aggregation.

**Gaps**:
- `admin.controller.js` revenue summary runs multiple `aggregate` pipelines in series; could use `$facet` to run in one round-trip.
- `reportsController.js` gift + salary summary runs separate `$group` stages; combine with `$facet`.
- No `$lookup` optimizations — some controllers populate in loops instead of using aggregation `$lookup`.

**Recommendation**:
- Convert multi-aggregation dashboards to single `$facet` pipelines.
- Add `allowDiskUse: true` to aggregations that might exceed 100MB RAM.

---

## 5. Cache / Redis

Observations:
- **Redis ranking**: sorted-set leaderboards in `RedisRankingService`. TTL 24h. Atomic `zAdd` + `expire`.
- **Redis OTP**: primary storage with memory fallback.
- **Redis matchmaking**: blind-date queue as Redis list.
- **Redis family online**: `family:online:{familyId}` set.
- **Redis rate limiting**: gift actions only.
- **No HTTP response caching**: no `Cache-Control`, `ETag`, or `Last-Modified` on API responses.
- **No Redis HTTP session store**: sessions are DB-backed (JWT + DeviceSession).

**Gaps**:
- Ranking batch init (`initializeAllRankingsFromDB`) issues O(n) sequential Redis commands; should pipeline.
- No Redis cache for frequent read-heavy endpoints like `/api/rooms/live`, `/api/gifts/store`, `/api/rankings/*`.
- No cache invalidation strategy for gift store or room list.

**Recommendation**:
- Add `client.pipeline()` in `RedisRankingIntegration.initializeAllRankingsFromDB`.
- Cache `/api/rooms/live` for 30s with Redis `SETEX` and `GET` short-circuit.
- Cache `/api/gifts/store` for 5min (invalidate on admin gift update).

---

## 6. Compression

Observations:
- **No gzip/brotli middleware** in `app.js`. All JSON responses are sent uncompressed.
- `express.json()` parses bodies but no `compression()` middleware.
- Large payloads: admin user lists, transaction history, family chat messages, analytics dashboards.

**Impact**:
- JSON payloads of 100KB+ (e.g., transaction history with 500 entries) waste bandwidth and increase latency.

**Recommendation**:
- Add `compression()` middleware to `app.js` with threshold 1KB.
- Enable brotli if `accept-encoding` includes it.

---

## 7. Memory

Observations:
- 🟡 `analyticsWorker.js:runHourlyActivityAggregation` loads all `onlineUsers` into memory, then loops issuing `UserActivity.findOneAndUpdate` per user. With 10k online users, this holds 10k document refs in memory and issues 10k sequential DB ops.
- 🟡 `otp.service.js` uses global `Map` with no eviction if Redis is down.
- 🟢 `RedisRankingService` — sorted sets in Redis, not process memory.
- 🟢 `MonitoringService` — latency samples capped at 1000.
- 🟢 `queueService.js` — queue references cached in `this.queues`; closed queues are deleted.

**Recommendation**:
- Paginate `onlineUsers` in analytics worker: process in batches of 1000.
- Add LRU cap to `otpMemoryStore`.

---

## 8. CPU

Observations:
- 🟡 `powerMatrixSocket.js:validateSocketPower` performs **4 parallel DB queries** (actor, target, powerMatrix, room) on every room action (mute, kick, lock). Under high room activity, this saturates DB connections.
- 🟡 `roomSocket.js:handleJoinRoom` calls `io.in(roomId).fetchSockets()` for membership checks in some paths — O(n) per call.
- 🟡 `eventSchedulerService.js:runSchedulerCycle` runs 9 parallel tasks every 60s; each task may scan entire collections (`Event.find()`, `Tournament.find()`). Acceptable for small collections but should be profiled at scale.
- 🟢 `giftSocket.js` — Redis rate limit check is O(1). Good.

**Recommendation**:
- Cache `PowerMatrix.findOne({ isActive: true })` in memory with version invalidation.
- Use Redis set membership for room participants instead of `fetchSockets()` when only need count/existence.

---

## 9. Aggregation Pipelines Detail

Common patterns:
- `find().sort().skip().limit().lean()` — dominates list endpoints.
- Aggregations are rare but exist in admin/reporting:
  - `adminController.js`: `$match` + `$group` for revenue.
  - `moduleManagerController.js`: `Transaction.aggregate([...])`.
  - `webViewGameController.js`: game ledger `$group`.

**Missing**:
- No `$facet` for multi-metric dashboards.
- No `$bucket` for age/session distribution.
- No time-series collation (`date_trunc` equivalent in app code).

---

## 10. Response Size

- **No field projection** on many list endpoints — full documents returned.
- Example: `adminController.js` user list returns full `User` document including `password`, `refreshTokens`, etc. unless explicitly `.select()`-ed.
- `room.production.controller.js` does project specific fields — good pattern.
- `familyController.js` often uses `.lean()` but returns full embedded arrays.

**Recommendation**:
- Audit all list endpoints for `.select()` to exclude sensitive fields.
- Add `maxLimit` guard (e.g., `Math.min(limit, 100)`).

---

## 11. Frontend Compatibility / Compression

- JSON-only; good for mobile.
- No response compression.
- No `Cache-Control` headers on static-ish data (gift catalog, room list, rankings).

---

## 12. Security vs Performance Tradeoffs

- `skip/limit` deep pagination is safe but slow at high offsets.
- Caching rankings in Redis improves perf but introduces eventual consistency (TTL 24h).
- No server-side game outcome verification saves CPU but enables fraud (already flagged in financial audit).

---

## Summary of Findings

| # | Severity | File | Issue |
|---|---|---|---|
| 1 | 🔴 HIGH | `familyController.js` | N+1 bulkWrite in `updateLeaderboard` / `updateLeaderboardForMember` |
| 2 | 🔴 HIGH | `analyticsWorker.js` | Unbounded onlineUsers loop; memory + sequential DB flood |
| 3 | 🟡 MEDIUM | All dashboard controllers | No `$facet` for multi-metric aggregation |
| 4 | 🟡 MEDIUM | `powerMatrixSocket.js` | 4 DB queries per socket action; cache PowerMatrix |
| 5 | 🟡 MEDIUM | `roomSocket.js` | `fetchSockets()` O(n) per join for membership checks |
| 6 | 🟢 LOW | `app.js` | No gzip/brotli compression middleware |
| 7 | 🟢 LOW | `RedisRankingIntegration` | Batch init without pipeline |
| 8 | 🟢 LOW | Various list endpoints | No `maxLimit` guard; risk of 1000+ document responses |

---

## Recommendations Priority

### P0 — Throughput
1. **Fix N+1 in family leaderboard** — use `bulkWrite`.
2. **Batch analytics worker** — paginate `onlineUsers` or reject if > 5000.
3. **Add compression middleware** — `compression()` in `app.js`.

### P1 — DB Efficiency
4. **Cache PowerMatrix** in memory with invalidation.
5. **Use `$facet`** for admin dashboard aggregations.
6. **Add `maxLimit`** to all list endpoints.

### P2 — Observability
7. **Pipeline ranking init** — `client.pipeline()` in `RedisRankingIntegration`.
8. **Replace `onlineUsersInRooms` with Redis** — multi-worker scalability.

---

## Positive Patterns

- **242 model indexes** with compound and unique constraints.
- **Consistent pagination** with `page/limit` and `total/pages`.
- **Lean queries** used extensively to reduce memory footprint.
- **TTL indexes** on temporary/session data.
- **Redis sorted sets** for high-performance leaderboards.
- **Promise.all** for parallel reads where order doesn't matter.

---

*End of report.*