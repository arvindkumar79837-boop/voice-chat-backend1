# Maintainability Audit Report — Arvind Party Backend

**Date**: 2025-07-31  
**Scope**: Duplicate code, dead code, unused files, circular dependencies, large controllers/services, magic numbers, naming conventions, architecture  
**Total Files**: 350 JS files in `src/`

---

## Executive Summary

The codebase is **large and monolithic** (350 files) with **significant maintainability debt**. The top 10 controllers alone average **30KB+ each**, with `familyController.js` (80KB) and `walletController.js` (72KB) acting as **god objects** that handle too many concerns. There is **duplicate logic** across controllers (revenue calculations, validation patterns, socket handler wrappers), **dead code** (commented sections, unused exports), **magic numbers** sprinkled across services, and **naming inconsistencies** (snake_case vs camelCase). The architecture is functionally organized but lacks clear separation of concerns at the file level.

| Category | Status |
|---|---|
| Duplicate Code | 🟡 Many repeated patterns (validation, pagination, agency lookup) |
| Dead Code | 🟡 Commented-out code, deprecated functions, unused routes |
| Unused Files | 🟢 Most files are imported/used; some orphaned configs |
| Circular Dependencies | 🟢 No obvious cycles; require() patterns are tree-like |
| Large Controllers | 🔴 God objects: `familyController.js` 80KB, `walletController.js` 72KB |
| Large Services | 🟡 `analytics.service.js` 29KB, `eventSchedulerService.js` 16KB |
| Magic Numbers | 🔴 Many hardcoded values (timeouts, limits, thresholds) |
| Naming | 🟡 Mixed snake_case/camelCase, legacy aliases, inconsistent file names |
| Architecture | 🟡 Layered but leakage; controllers call services directly, sockets mix IO |

---

## 1. Duplicate Code

| Severity | Location | Issue |
|---|---|---|
| 🟡 MEDIUM | `familyController.js`, `agencyController.js`, `walletController.js` | Agency lookup pattern `Agency.findOne({ hosts: userId })` repeated in ~15 controllers. Should be a shared middleware or helper. |
| 🟡 MEDIUM | `adminController.js`, `moduleManagerController.js` | Pagination logic (`page = parseInt(req.query.page, 10) || 1`, `limit = parseInt(...)`) repeated in **25+ controllers**. Should be a shared utility. |
| 🟡 MEDIUM | `familyController.js`, `familyWarController.js`, `familySocket.js` | Family existence validation (`Family.findOne({ familyId })`) repeated across multiple files. |
| 🟡 MEDIUM | `roomSocket.js`, `roomFeaturesSocket.js`, `roomFeaturesController.js` | Room ownership checks (`room.ownerId.toString() === userId`) repeated in multiple socket handlers. |
| 🟢 OK | `src/utils/` | `jwt.js`, `logger.js`, `asyncHandler.js` properly centralized. |
| 🟡 MEDIUM | `gameController.js`, `game.controller.js` | Two near-identical controllers for game logic (`gameController.js` and `game.controller.js`). Need consolidation. |

**Recommendation**:
- Extract agency lookup to middleware: `addAgencyToRequest()`.
- Create `paginationHelper.js` with `parsePagination(req, defaultLimit = 50)`.
- Consolidate `gameController.js` and `game.controller.js` into one file.

---

## 2. Dead Code

| Severity | Location | Issue |
|---|---|---|
| 🟡 MEDIUM | `src/utils/jwt.js:48-52` | Deprecated `generateToken()` — still exported but marked deprecated. Used by any old controller? |
| 🟡 MEDIUM | `familyController.js` | Multiple commented-out sections (e.g., `// const Logger = require(...)` at line 2086). |
| 🟡 MEDIUM | `roomSocket.js` | 100+ lines of commented-out code remain for legacy handlers. |
| 🟡 MEDIUM | `gameRoutes.js:10-24` | Stubbed CRUD routes (`res.json({ success: true, data: [] })`) — no real implementation. |
| 🟢 OK | `src/controllers/` | Most exported functions are used in routes. |
| 🟢 OK | `src/services/` | All services appear to be initialized in `server.js`. |

**Recommendation**:
- Remove deprecated `generateToken()` after confirming no callers.
- Delete commented-out code blocks.
- Implement or remove stubbed game CRUD routes.

---

## 3. Unused Files

| Severity | Location | Issue |
|---|---|---|
| 🟡 MEDIUM | `src/config/jwt.js` | Exists alongside `src/utils/jwt.js` — may be unused. |
| 🟡 MEDIUM | `src/controllers/room.controller.js` | Exists alongside `room.production.controller.js` — may be legacy. |
| 🟡 MEDIUM | `src/controllers/gameController.js` | Dual controller with `game.controller.js` — one is likely unused. |
| 🟢 OK | `src/models/` | All models are referenced in controllers/services. |
| 🟢 OK | `src/middlewares/` | Middlewares are imported in routes or app.js. |

**Recommendation**:
- Audit `src/config/jwt.js` vs `src/utils/jwt.js` — consolidate to one.
- Check if `room.controller.js` is still used or if `room.production.controller.js` replaced it.
- Consolidate `gameController.js` and `game.controller.js`.

---

## 4. Circular Dependencies

| Severity | Location | Issue |
|---|---|---|
| 🟢 OK | `src/sockets/index.js` | Imports services, but no service imports back from sockets. |
| 🟢 OK | `src/controllers/` | Controllers import models, but models don't import controllers. |
| 🟢 OK | `src/services/` | Services are independent; no mutual imports found. |
| 🟡 MEDIUM | `server.js` | Requires controller files inside cron jobs (e.g., `salaryController.calculateMonthlySalary`). This is loose coupling via `require()` at call time, not true circular dependency, but it's a code smell. |

**Recommendation**:
- Move cron-based controller calls into dedicated cron handlers or queue jobs.

---

## 5. Large Controllers (God Objects)

| File | Size | Lines (approx) | Responsibilities |
|---|---|---|---|
| `familyController.js` | 80KB | ~2000 | Family CRUD, admin, stay rewards, leaderboard, PK, wars, search, invitations, chat |
| `walletController.js` | 72KB | ~1800 | Wallet CRUD, exchange, withdrawal, family wallet, agency wallet, income analytics, admin |
| `vipSystemController.js` | 48KB | ~1200 | VIP plans, SVIP, premium, cosmetics, missions, leaderboard, admin |
| `room.production.controller.js` | 40KB | ~1000 | Room CRUD, live, ranking, seats, PK, tasks, cosmetics, admin |
| `eventController.js` | 39KB | ~975 | Event CRUD, progress, rewards, prizes, admin, festival, anniversary |
| `moduleManagerController.js` | 36KB | ~900 | CMS, banners, ads, reports, backup, settings, audit, gifts, VIP, modules |
| `dealerController.js` | 30KB | ~750 | Dealer wallet, transfer, refund, transactions, stats, admin |
| `authSecure.controller.js` | 24KB | ~600 | 2FA, device sessions, login history, password reset, social links |
| `agencyController.js` | 20KB | ~500 | Agency CRUD, hosts, earnings, applications, admin |
| `roomFeaturesController.js` | 19KB | ~475 | Room features, cosmetics, privacy, follow, level, admin |

**Recommendation**:
- Split `familyController.js` into: `family.core.controller.js`, `family.leaderboard.controller.js`, `family.stayReward.controller.js`.
- Split `walletController.js` into: `wallet.core.controller.js`, `wallet.withdrawal.controller.js`, `wallet.agency.controller.js`, `wallet.admin.controller.js`.
- Split `vipSystemController.js` into: `vip.membership.controller.js`, `vip.cosmetics.controller.js`, `vip.missions.controller.js`.

---

## 6. Large Services

| File | Size | Lines (approx) | Responsibilities |
|---|---|---|---|
| `analytics.service.js` | 29KB | ~725 | Revenue, engagement, gifts, agencies, families, charts, heatmap, daily aggregation |
| `eventSchedulerService.js` | 16KB | ~400 | Event activation, expiration, tournament, championship, lucky draw, streak |
| `redisRankingService.js` | 20KB | ~500 | Redis sorted-set operations for wealth, charm, gifts, families, agencies, rooms |
| `backupService.js` | 14KB | ~350 | Backup create, restore, history, scheduling |
| `deploymentService.js` | 13KB | ~325 | Deploy, rollback, webhook, health verification |

**Recommendation**:
- Split `analytics.service.js` into: `analytics.revenue.service.js`, `analytics.engagement.service.js`, `analytics.gift.service.js`.
- Split `eventSchedulerService.js` into: `event.scheduler.service.js`, `tournament.scheduler.service.js`, `luckyDraw.scheduler.service.js`.

---

## 7. Magic Numbers

| Severity | Location | Issue |
|---|---|---|
| 🟡 MEDIUM | `server.js:147` | Blind date cron runs every `3 seconds` — hardcoded. Should be env variable. |
| 🟡 MEDIUM | `giftQueueWorker.js:22-30` | `removeOnComplete: { count: 500, age: 24*3600 }`, `removeOnFail: { count: 1000, age: 7*24*3600 }` — hardcoded. |
| 🟡 MEDIUM | `redisRankingService.js:16` | `TTL = 86400` (24h) — hardcoded. |
| 🟡 MEDIUM | `otp.service.js:27` | OTP length `6` — hardcoded. |
| 🟡 MEDIUM | `otp.service.js:31` | Expiry `5 minutes` — hardcoded. |
| 🟡 MEDIUM | `analyticsWorker.js` | `15 minutes` revenue update interval, `60 minutes` hourly aggregation — hardcoded. |
| 🟡 MEDIUM | `monitoringService.js:108-110` | Latency samples capped at `1000` — hardcoded. |
| 🟡 MEDIUM | `healthAlertService.js:17-26` | Alert thresholds (memory 85%, CPU 90%, queue 1000 pending) — hardcoded. |
| 🟡 MEDIUM | `socket/index.js` | `reconnectionDelay: 1000`, `maxDisconnectionDuration: 5000` — hardcoded in server.js. |
| 🟢 OK | `ecosystem.config.js` | `max_memory_restart: '1G'` — hardcoded but acceptable for PM2. |

**Recommendation**:
- Move all magic numbers to environment variables or a config file.
- Create `src/config/constants.js` for app-wide constants (OTP length, rate limits, TTLs, etc.).

---

## 8. Naming Conventions

| Severity | Location | Issue |
|---|---|---|
| 🟡 MEDIUM | `src/controllers/` | Mixed: `auth.controller.js` vs `authSecure.controller.js` vs `firebaseAuth.controller.js` vs `googleAuthController.js` — inconsistent file naming. |
| 🟡 MEDIUM | `src/controllers/` | `game.controller.js` vs `gameController.js` — two files for same concept. |
| 🟡 MEDIUM | `src/controllers/` | `analytics.controller.js` vs `analytics.service.js` — controller and service naming conventions differ. |
| 🟡 MEDIUM | Route files | `auth.routes.js`, `room.routes.js`, `gift.routes.js` vs `familyRoutes.js`, `wallet.routes.js` vs `adminRoutes.js` — inconsistent extensions. |
| 🟡 MEDIUM | Model fields | Mixed `snake_case` and `camelCase`: `User.is_active` vs `User.isBanned`, `GiftEvent.senderId` vs `Family.is_active`. |
| 🟡 MEDIUM | Route imports | `wallet.routes.js` imports `auth` as alias for `authMiddleware`, while `familyRoutes.js` imports `authMiddleware` directly. |
| 🟢 OK | `src/services/` | Mostly consistent `camelCase` naming. |
| 🟢 OK | `src/middlewares/` | Mostly consistent `kebab-case` naming. |

**Recommendation**:
- Adopt a naming convention: `*.controller.js`, `*.service.js`, `*.routes.js`, `*.model.js`.
- Migrate model fields to `camelCase` consistently.
- Consolidate duplicate controller files (`gameController.js` → `game.controller.js`).

---

## 9. Architecture

| Aspect | Status | Notes |
|---|---|---|
| Layering | 🟡 Leaky | Controllers sometimes call DB directly (bypassing services). Some services have business logic that belongs in controllers. |
| Separation of Concerns | 🟡 Weak | God objects (familyController, walletController) handle CRUD, auth, admin, analytics, and real-time events. |
| Socket vs HTTP | 🟢 Clear | Sockets handle real-time events; HTTP handles REST API. |
| Models | 🟢 Clean | Mongoose schemas with indexes, statics, methods. |
| Middleware | 🟢 Clear | Auth, validation, power matrix, admin role checks are well-separated. |
| Error Handling | 🟡 Inconsistent | Some controllers use `try/catch` with `res.status(500).json(...)`, others use `asyncHandler` wrapper. |
| Config | 🟢 Centralized | Redis, DB, Firebase, CORS configs in `src/config/`. |
| Workers | 🟢 Separate | Gift queue, analytics, and cron workers in `src/workers/`. |

**Architecture Issues**:
- **No service layer for business logic**: Controllers contain both request handling AND business logic. This makes unit testing difficult.
- **No DTO layer**: Response shapes are assembled inline in controllers. Changing an API response requires editing the controller.
- **No repository pattern**: DB queries are scattered across controllers and services. A change to a schema requires updating every query.
- **Socket handlers are monolithic**: `roomSocket.js` (883 lines) handles join, leave, seats, PK, moderation, announcements, cosmetics, layout — should be split into multiple handler files.

**Recommendation**:
- Introduce a service layer: `src/services/domain/` with `room.service.js`, `wallet.service.js`, `family.service.js`.
- Introduce a repository layer: `src/repositories/` for complex queries.
- Split socket handlers by domain: `room.seat.socket.js`, `room.pk.socket.js`, `room.moderation.socket.js`.

---

## 10. File Organization Summary

| Directory | Files | Clean? | Issues |
|---|---|---|---|
| `src/controllers/` | 87 | 🟡 | Too many god objects, mixed naming, inline logic |
| `src/services/` | 20+ | 🟢 | Mostly clean, but some are too large |
| `src/models/` | 95+ | 🟢 | Clean schemas with indexes |
| `src/routes/` | 76 | 🟢 | Well-organized, some inconsistent naming |
| `src/sockets/` | 18 | 🟡 | Some handlers too large (roomSocket.js 883 lines) |
| `src/middlewares/` | 12 | 🟢 | Clean separation |
| `src/config/` | 8 | 🟢 | Centralized configuration |
| `src/workers/` | 2 | 🟡 | analyticsWorker.js is not a BullMQ worker (uses setInterval) |
| `src/utils/` | 5+ | 🟢 | Clean utility functions |

---

## 11. Security Concerns (from Maintainability Perspective)

| # | Severity | Issue |
|---|---|---|
| 1 | 🟡 MEDIUM | God objects make security audits harder — a bug in `familyController.js` could affect 2000+ lines of code. |
| 2 | 🟡 MEDIUM | Dead code creates confusion: a security fix applied to one file may not be applied to its duplicate. |
| 3 | 🟢 LOW | Magic numbers in rate limits make it hard to tune without code changes. |

---

## 12. Recommendations Priority

### P0 — Structural
1. **Split god controllers**: `familyController.js`, `walletController.js`, `vipSystemController.js`.
2. **Consolidate duplicates**: `gameController.js` / `game.controller.js`, `room.controller.js` / `room.production.controller.js`.
3. **Remove dead code**: commented-out blocks, deprecated `generateToken()`, stubbed CRUD routes.

### P1 — Consistency
4. **Standardize naming**: `*.controller.js`, `*.routes.js`, `*.service.js`.
5. **Migrate model fields** to `camelCase` (e.g., `is_active` → `isActive`).
6. **Extract magic numbers** to `src/config/constants.js`.

### P2 — Architectural
7. **Introduce service layer** for business logic.
8. **Split socket handlers** by domain.
9. **Add pagination helper** to reduce repeated code.

---

## Positive Patterns

- Clean model definitions with indexes and statics.
- Centralized configuration in `src/config/`.
- Good middleware separation for auth, validation, and admin.
- Workers for background jobs (gift queue, analytics).
- Most files are single-purpose (except god objects).
- No circular dependencies detected.

---

*End of report.*