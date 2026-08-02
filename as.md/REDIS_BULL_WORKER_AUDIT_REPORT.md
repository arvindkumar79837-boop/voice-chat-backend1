# Redis · BullMQ · Workers · Cron · Cache · Ranking · OTP · Sessions Audit Report

**Date**: 2025-07-31  
**Scope**: Redis config/clients, BullMQ queues/workers, cron jobs, cache/ranking, OTP, auth sessions, memory leaks, crash handling, retry/DLQ  
**Total Files Audited**: 14 core files

---

## Executive Summary

The platform uses **two Redis clients** (node-redis for cache/OTP/ranking and ioredis for BullMQ). This dual-client pattern is valid but increases operational surface. **BullMQ workers have retry/backoff but no explicit Dead Letter Queue (DLQ); failed jobs rely on `removeOnFail` cleanup.** Cron robustness varies — event scheduler swallows errors, while salary cron and scheduler use safe `try/catch` patterns. OTP uses Redis primary with safe memory fallback. Session handling is solid with TTL auto-expiry for 2FA.

| Category | Status |
|---|---|
| Duplicate Redis | 🟢 Intentional dual-client (node-redis + ioredis); single shared client per concern |
| Memory Leak | 🟡 One unbounded in-memory OTP fallback map; latency sample buffer capped |
| Worker Crash | 🟡 No `process.on('uncaughtException')` in worker boundary; BullMQ event handlers present |
| Retry | 🟢 Exponential backoff in gift/queue workers; attempts=3 default |
| Dead Letter Queue | 🟡 No separate DLQ; failed jobs cleaned via `removeOnFail`. Acceptable if `removeOnFail` is enabled. |
| Cache | 🟢 Ranking TTL 24h; OTP TTL 5min |
| Ranking | 🟢 Sorted-set leaderboards; batch init from MongoDB; `expire(key, TTL)` called |
| OTP | 🟢 Redis primary + memory fallback; auto-delete on verify |
| Sessions | 🟢 DeviceSession lookup with `lastActivityAt`; TwoFactorSession TTL index |

---

## Files Audited

| File | Lines | Purpose |
|---|---|---|
| `src/config/redis.js` | 101 | Shared node-redis client (OTP, ranking, general cache) |
| `src/services/queueService.js` | 280 | BullMQ queue factory (ioredis), create/add/close/pause/clean |
| `src/workers/analyticsWorker.js` | 144 | setInterval-based analytics cron (not BullMQ) |
| `src/workers/giftQueueWorker.js` | 352 | BullMQ worker for gift send/bulk/animation |
| `src/services/redisRankingService.js` | 467 | Redis sorted-set leaderboards |
| `src/services/redisRankingIntegration.js` | 287 | DB→Redis ranking initializer |
| `src/services/otp.service.js` | 131 | OTP generate/store/verify (Redis + memory fallback) |
| `src/services/schedulerService.js` | 146 | Target audit + auto-settlement cron |
| `src/services/eventSchedulerService.js` | ~480 | Event/tournament/daily-task activation cron |
| `src/services/monitoringService.js` | 174 | CPU/mem/redis/db/socket/queue metrics |
| `server.js` | 444 | Cron jobs (salary, agency expiry, subscription, blind date), init, shutdown |
| `src/middlewares/auth.middleware.js` | 122 | JWT auth + 2FA session guard |
| `src/models/TwoFactorSession.js` | ~50 | 2FA session with TTL index |
| `src/models/DeviceSession.js` | ~60 | Device session schema |

---

## Detailed Findings

### 1. Duplicate Redis

| Severity | Location | Description |
|---|---|---|
| 🟢 OK | `config/redis.js` | Shared node-redis client (`redisClient`) used for OTP, ranking, general cache. |
| 🟢 OK | `queueService.js` | Separate ioredis client (`this.redisClient`) for BullMQ. |
| 🟢 OK | `otp.service.js` | Reuses shared `getRedisClient()`; does not instantiate a second client. |
| 🟢 OK | `redisRankingService.js` | Reuses shared `getRedisClient()` via getter. |

**Recommendation**: None. Two Redis clients are valid because BullMQ requires ioredis (or compatible), while ranking/OTP use node-redis. Ensure `REDIS_URL` is consistent across both.

---

### 2. Memory Leak

| Severity | Location | Description |
|---|---|---|
| 🟡 MEDIUM | `otp.service.js:23` | `otpMemoryStore` is a global `Map` with no eviction. If Redis is down and many OTPs are generated, memory grows indefinitely until Redis recovers or process restarts. |
| 🟢 OK | `monitoringService.js:108-110` | Latency `samples` array capped at 1000. |
| 🟡 MEDIUM | `analyticsWorker.js:93-103` | `runHourlyActivityAggregation` loads all `onlineUsers` then issues individual `UserActivity.findOneAndUpdate` in a loop. With large user bases, this can hold many document refs in memory per iteration. |
| 🟢 OK | `redisRankingService.js` | Sorted sets live in Redis, not process memory. Keys have TTL. |

**Recommendation**:
- Set a max-size LRU cap on `otpMemoryStore`: if size > 10000, delete oldest entries.
- Paginate `onlineUsers` in analytics worker or reject if > 5000 in one tick.

---

### 3. Worker Crash

| Severity | Location | Description |
|---|---|---|
| 🟡 MEDIUM | `giftQueueWorker.js:40-54` | BullMQ worker created without error-first event handlers beyond `'failed'` and `'error'`. If the Redis connection drops, BullMQ emits `'error'` and the worker terminates silently. No re-initialization logic exists. |
| 🟢 OK | `queueService.js:132-137` | Queue-level error handler logs Redis version errors; does not crash. |
| 🟡 MEDIUM | `analyticsWorker.js` | Uses bare `setInterval` — uncaught exception in `runHourlyActivityAggregation` is logged but the interval keeps running; no backoff. Safe but no circuit breaker. |
| 🟢 OK | `schedulerService.js:140-142` | `setInterval` wraps in try/catch. |

**Recommendation**:
- Add BullMQ worker `'error'` listener in `giftQueueWorker.js` to reconnect or exit with backoff.
- Wrap worker initialization in a supervisor in `server.js` that restarts on crash (already in-process; add `process.on('uncaughtException')` guard).

---

### 4. Retry

| Severity | Location | Description |
|---|---|---|
| 🟢 OK | `queueService.js:119-125` | Default job options: `attempts: 3`, `backoff: { type: 'exponential', delay: 1000 }`. |
| 🟢 OK | `giftQueueWorker.js:22-30` | `removeOnComplete: { count: 500, age: 24*3600 }`, `removeOnFail: { count: 1000, age: 7*24*3600 }`. |
| 🟢 OK | `giftQueueWorker.js:56-64` | `worker.on('completed')` and `worker.on('failed')` emit success/failure logs. Failed jobs automatically retry. |
| 🟡 MEDIUM | `giftQueueWorker.js:91-203` | `processGiftSend` catches DB errors andthrows, which triggers BullMQ retry. If a failure is permanent (e.g., Gift not found), Retry wastes cycles and logs noise. |

**Recommendation**:
- Add `nonRetryable` check in worker: if error === 'Gift not found' or 'User not found', do not throw — return failure result or set job progress to failed manually.
- Consider `attempts: 5` for financial jobs and `attempts: 1` for validation-only jobs.

---

### 5. Dead Letter Queue

| Severity | Location | Description |
|---|---|---|
| 🟡 MEDIUM | `queueService.js` | No explicit DLQ. Failed jobs go to `failed` state in Redis and get cleaned by `removeOnFail` after 7 days. If an admin needs to inspect/retry failed gifts, they are gone after 7 days. |
| 🟢 OK | `queueService.js` | `getQueueStats()` exposes `failed` count. |
| 🟡 MEDIUM | `giftQueueWorker.js` | No `moveToDLQ` or `failed` handler that preserves job data for review. |

**Recommendation**:
- Add a delayed job to archive failed job payloads to a `gift-processing-dlq` queue or MongoDB collection before `removeOnFail` cleans them.
- Expose `/api/admin/queues/gift-processing/dlq` endpoint.

---

### 6. Cache

| Severity | Location | Description |
|---|---|---|
| 🟢 OK | `redisRankingService.js:16` | Ranking key TTL = 86400s (24h). |
| 🟢 OK | `otp.service.js:38` | OTP `setEx(key, 300, otp)` — 5 minute TTL. |
| 🟢 OK | TwoFactorSession | TTL index on `expiresAt` (`expireAfterSeconds: 0`). |
| 🟡 MEDIUM | `familySocket.js` | `staySessionKey(uid)` uses Redis `SET EX 86400`. Good. But `getRedis()` call inside `redeemStayReward` does not verify `isOpen` before use — if Redis is down, `getRedis()` may return stale client. |
| 🟢 OK | `queueService.js` | Queue creation is idempotent (`this.queues[queueName]` cache). |

**Recommendation**:
- In `familySocket.js` and other Redis readers, guard `getRedis().get(...)` with `if (!client?.isOpen) return safeDefault`.

---

### 7. Ranking

| Severity | Location | Description |
|---|---|---|
| 🟢 OK | `redisRankingService.js` | Atomic `zAdd` + `expire(key, TTL)` after every score change. |
| 🟢 OK | `redisRankingIntegration.js:179-242` | `initializeAllRankingsFromDB` and `initializeGiftRankingsFromDB` rebuild sorted sets from MongoDB on demand. |
| 🟢 OK | `redisRankingService.js:401-434` | `flushPeriod` and `flushAll` allow admin cache bust. |
| 🟡 MEDIUM | `redisRankingIntegration.js:178-284` | Batch init iterates users, families, agencies, rooms sequentially. With 100k users this is O(n) Redis ops without pipelining — slow and memory-heavy. |

**Recommendation**:
- Use Redis pipeline in `initializeAllRankingsFromDB`: accumulate `zAdd` calls and `exec` once per entity type.

---

### 8. OTP

| Severity | Location | Description |
|---|---|---|
| 🟢 OK | `otp.service.js` | Redis primary, memory fallback. TTL enforced. Delete-on-verify. |
| 🟡 MEDIUM | `otp.service.js` | No rate limit on OTP send per phone number. An attacker could trigger infinite OTP floods (cost risk on SMS gateway). |
| 🟢 OK | `otp.service.js` | In-memory OTP TTL handled via `expiresAt` check. |

**Recommendation**:
- Add Redis rate limiter: `otp:limit:{phone}` with TTL 60s and max 3 sends per minute.

---

### 9. Sessions

| Severity | Location | Description |
|---|---|---|
| 🟢 OK | `TwoFactorSession` | TTL index auto-expires sessions after 1h. |
| 🟢 OK | `auth.middleware.js` | `TwoFactorSession.findOne({ userId, verified: true, expiresAt: { $gt: new Date() } })`. |
| 🟢 OK | `DeviceSession` | Used in `authSocket.js` to bind socket to DB session via `sessionToken`. |
| 🟡 MEDIUM | `authSocket.js` | Activity updates update `lastActivityAt` but do not extend expiry — sessions may expire while user is active. |
| 🟡 MEDIUM | `server.js` | Graceful shutdown handles HTTP, Socket.IO, Redis — but pending BullMQ jobs are not drained. |

**Recommendation**:
- In `authSocket.js` heartbeat/socket handler, reset `expiresAt` on `lastActivityAt` update.
- In `server.js` graceful shutdown, await `queueService.disconnect()` to drain active jobs.

---

### 10. Cron Robustness

| Severity | Location | Description |
|---|---|---|
| 🟢 OK | `server.js:94-118` | Monthly salary cron uses `Promise.all` per agency; errors local to agency do not fail others. |
| 🟢 OK | `server.js:121-131` | Agency target expiry cron — individual `try/catch`. |
| 🟢 OK | `server.js:134-144` | Subscription expiry cron — safe. |
| 🟡 MEDIUM | `server.js:147-154` | Blind Date queue processor runs every 3 seconds. Error is silently swallowed (`// Silent — errors logged inside processQueue`). If blindDateController throws synchronously, cron may backpressure Redis/Mongo with rapid retries. |
| 🟢 OK | `eventSchedulerService.js` | `runSchedulerCycle` wraps 9 parallel tasks; each task handles its own errors. |
| 🟢 OK | `analyticsWorker.js` | `setInterval` fails are logged and continue. |

**Recommendation**:
- Add exponential backoff to blind date cron on repeated failures.

---

## Security Concerns Summary

| # | Severity | File | Issue |
|---|---|---|---|
| 1 | 🟡 MEDIUM | `otp.service.js:23` | Unbounded memory OTP fallback map |
| 2 | 🟡 MEDIUM | `giftQueueWorker.js` | BullMQ worker crash on Redis loss — no reconnect |
| 3 | 🟡 MEDIUM | `queueService.js` | No explicit DLQ; failed jobs purged after 7 days |
| 4 | 🟡 MEDIUM | `redisRankingIntegration.js` | Batch init without pipeline — O(n) sequential |
| 5 | 🟡 MEDIUM | `authSocket.js` | Device session TTL not extended on activity |
| 6 | 🟢 LOW | `server.js` | Blind date cron silent error swallow |
| 7 | 🟢 LOW | `analyticsWorker.js` | Unbounded sequential onlineUsers per tick |

---

## Recommendations Priority

### P0 — Production Hardening
1. **Add BullMQ DLQ policy** — archive failed jobs to MongoDB/DLQ before purge.
2. **Add OTP rate limit** — max 3 sends per phone per minute.

### P1 — Reliability
3. **Add worker supervisor** — restart giftQueueWorker if BullMQ emits fatal error.
4. **Pipeline ranking initialization** — use `client.pipeline()` for batch `zAdd`.
5. **Extend DeviceSession TTL on activity** — keep logged-in users alive.

### P2 — Observability
6. **Expose queue stats endpoint** — failed/waiting/active counts.
7. **Add backoff to blind date cron** — efficient failure handling.
8. **Cap OTP memory map** — LRU or size limit.

---

## Positive Patterns

- BullMQ exponential backoff and attempt caps.
- Dual-Redis separation of cache vs queue concerns.
- OTP fallback to memory prevents total lockout when Redis is down.
- TTL indexes on temporary sessions (2FA).
- `flushPeriod` / `flushAll` for ranking Cache busting.
- Graceful shutdown covers HTTP, Socket.IO, and Redis.

---

*End of report.*