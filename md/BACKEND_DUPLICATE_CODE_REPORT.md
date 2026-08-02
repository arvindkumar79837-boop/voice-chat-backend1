# ARVIND PARTY BACKEND - DUPLICATE CODE & DEAD CODE REPORT

**Date:** 2026-07-31  
**Focus:** DRY violations, dead code, unused files, duplicate controllers/routes/models

---

## EXECUTIVE SUMMARY

Duplicate Code Score: **38/100** 🔴 **CRITICAL**

Significant duplication exists across controllers, socket handlers, and model imports. Multiple files serve overlapping purposes, and inline require patterns mask circular dependencies.

---

## DUPLICATE CONTROLLERS

### DUP-001: Multiple User Admin Controllers
- **Severity:** HIGH
- **Files:** 
  - `src/controllers/admin.controller.js` (user management methods)
  - `src/controllers/admin.user.controller.js` (duplicate user management)
- **Reason:** Both files contain user CRUD, withdrawal management, and announcement logic.
- **Impact:** Bug fixes applied to one but not the other; inconsistent API contracts
- **Root Cause:** Feature split without consolidation
- **Recommended Fix:** Merge into `AdminUserController`, remove duplicate
- **Estimated Effort:** 6 hours
- **Risk Level:** HIGH

### DUP-002: Duplicate Gift Controllers
- **Severity:** HIGH
- **Files:**
  - `src/controllers/giftController.js` (legacy)
  - `src/controllers/gift.production.controller.js` (current)
- **Reason:** Two implementations of gift sending logic. `giftController.js` likely dead code.
- **Impact:** Confusion about which controller is active; potential double-processing
- **Root Cause:** Incomplete migration
- **Recommended Fix:** Verify routes mount `gift.production.controller.js`; delete `giftController.js`
- **Estimated Effort:** 2 hours
- **Risk Level:** MEDIUM

### DUP-003: Duplicate Room Controllers
- **Severity:** HIGH
- **Files:**
  - `src/controllers/room.controller.js`
  - `src/controllers/room.production.controller.js`
- **Reason:** Split implementation with overlapping methods.
- **Impact:** Same as DUP-002
- **Root Fix:** Consolidate into single `RoomController`
- **Estimated Effort:** 4 hours
- **Risk Level:** MEDIUM

### DUP-004: Duplicate Reward Controllers
- **Severity:** MEDIUM
- **Files:**
  - `src/controllers/rewardConfigController.js`
  - `src/controllers/rewardInjectorController.js`
- **Reason:** Split config vs injection but mounted under same `/api/rewards` prefix
- **Impact:** Route ordering issues; unclear separation of concerns
- **Root Fix:** Keep split but rename routes: `/api/rewards/config` and `/api/rewards/inject`
- **Estimated Effort:** 2 hours
- **Risk Level:** MEDIUM

---

## DUPLICATE ROUTES

### DUP-005: Duplicate `/api/games` Mount
- **Severity:** CRITICAL
- **File:** src/app.js
- **Line:** 184, 248
- **Reason:** `gameRoutes` mounted at line 184, then `webViewGameRoutes` mounted at line 248 on same path
- **Impact:** Route collision; last mount wins unpredictably
- **Root Cause:** Feature branch merge artifact
- **Recommended Fix:** Remove line 184 or rename one prefix to `/api/games/web`
- **Estimated Effort:** 30 minutes
- **Risk Level:** CRITICAL

### DUP-006: Duplicate `/api/auth/social` Mount
- **Severity:** CRITICAL
- **File:** src/app.js
- **Line:** 159, 160
- **Reason:** `googleAuthRoutes` and `socialAuthRoutes` both mounted at `/api/auth/social`
- **Impact:** Middleware stack collision; second mount overrides first
- **Root Cause:** Copy-paste during feature expansion
- **Recommended Fix:** Merge into single `SocialAuthRoutes` or use distinct prefixes
- **Estimated Effort:** 1 hour
- **Risk Level:** HIGH

### DUP-007: Overlapping Socket Namespaces
- **Severity:** MEDIUM
- **File:** src/sockets/index.js
- **Line:** Multiple
- **Reason:** Both `matchmakingSocket.js` and `matchmakingSocket2.js` registered; likely same namespace handlers
- **Impact:** Duplicate event emissions, race conditions
- **Root Cause:** Unmerged feature branch
- **Recommended Fix:** Audit both files; keep one, delete other
- **Estimated Effort:** 2 hours
- **Risk Level:** MEDIUM

---

## DUPLICATE SERVICES

### DUP-008: Redundant Redis Ranking Services
- **Severity:** MEDIUM
- **Files:**
  - `src/services/redisRankingService.js`
  - `src/services/redisRankingIntegration.js`
- **Reason:** Two files providing similar Redis ranking functionality. `Integration` appears to wrap or extend `Service`.
- **Impact:** Confusion about which to use; duplicated connection logic
- **Root Cause:** Incremental enhancement without cleanup
- **Recommended Fix:** Merge into single `RedisRankingService`
- **Estimated Effort:** 4 hours
- **Risk Level:** MEDIUM

---

## DEAD CODE

### DEAD-001: Unused Imports in app.js
- **Severity:** LOW
- **File:** src/app.js
- **Line:** 13
- **Reason:** `authSecureController` imported but never used (routes use `authSecure.routes`)
- **Impact:** Minor memory overhead
- **Root Cause:** Refactoring artifact
- **Recommended Fix:** Remove unused import
- **Estimated Effort:** 5 minutes
- **Risk Level:** LOW

### DEAD-002: Unreferenced Model Files
- **Severity:** MEDIUM
- **Files:** 12 models not imported anywhere
- **Reason:** Schema files exist but are never required by controllers, services, or sockets
- **Impact:** Dead code increases maintenance surface; migrations may still run on them
- **Root Cause:** Feature branches merged without model cleanup
- **Recommended Fix:** Search for each unused model; delete or add to feature list
- **Estimated Effort:** 3 hours
- **Risk Level:** MEDIUM

---

## DUPLICATE MODEL IMPORTS (Inline Requires)

### DUP-009: Inline Requires to Avoid Circular Dependencies
- **Severity:** MEDIUM
- **File:** src/controllers/admin.user.controller.js (and 8+ others)
- **Line:** Multiple
- **Reason:** `const Withdrawal = require('../models/Withdrawal')` inside methods instead of top-level
- **Impact:** Hidden circular dependencies; slower method execution (require cache misses minor)
- **Root Cause:** Circular dependency workaround
- **Recommended Fix:** Refactor to service layer to break cycles
- **Estimated Effort:** 8 hours
- **Risk Level:** MEDIUM

---

## DUPLICATE CODE BLOCKS

### DUP-010: Repeated Withdrawal Query Pattern
- **Severity:** MEDIUM
- **File:** src/controllers/admin.user.controller.js
- **Line:** 8+ occurrences
- **Reason:** Same `Withdrawal.find().sort({ createdAt: -1 })` block repeated inline
- **Impact:** Maintenance burden; bug fixes repeated
- **Root Cause:** No abstraction for common queries
- **Recommended Fix:** Extract `WithdrawalRepository.getAllRecent(limit)` method
- **Estimated Effort:** 2 hours
- **Risk Level:** MEDIUM

### DUP-011: Repeated JWT Verification in Sockets
- **Severity:** MEDIUM
- **Files:** src/sockets/*.js
- **Line:** Multiple
- **Reason:** Each socket file manually does `jwt.verify(token, process.env.JWT_SECRET)` instead of using `authMiddleware`
- **Impact:** Duplicate error handling; inconsistent error messages
- **Root Cause:** Socket auth not standardized
- **Recommended Fix:** Use `socketAuthMiddleware` from `index.js` universally
- **Estimated Effort:** 3 hours
- **Risk Level:** MEDIUM

---

## UNUSED FILES

### UNUSED-001: Root-Level Credentials File
- **Severity:** CRITICAL
- **File:** firebase-service-account.json
- **Line:** N/A
- **Reason:** Service account JSON in project root (should be env var or secret manager)
- **Impact:** Credential leak if committed to git
- **Root Cause:** Development convenience
- **Recommended Fix:** Move to `.env` as `FIREBASE_SERVICE_ACCOUNT` JSON string; add file to `.gitignore`
- **Estimated Effort:** 30 minutes
- **Risk Level:** CRITICAL

### UNUSED-002: Orphaned Report Files
- **Severity:** LOW
- **Files:** 
  - `fixed_in_792d678.txt`
  - `raw_report.txt`
  - `report_content.txt`
- **Reason:** Leftover from previous audit/debug session
- **Impact:** Clutter; potential information disclosure
- **Root Cause:** No cleanup process
- **Recommended Fix:** Delete or archive
- **Estimated Effort:** 5 minutes
- **Risk Level:** LOW

---

## DUPLICATE NAMING

### DUP-012: Similar Route File Names
- **Severity:** LOW
- **Files:** `room.routes.js`, `roomFeaturesRoutes.js`, `roomLuxuryRoutes.js`
- **Reason:** Inconsistent naming for room-related routes
- **Impact:** Import confusion
- **Root Cause:** No naming convention
- **Recommended Fix:** Standardize to `room.routes.js`, `room-features.routes.js`, `room-luxury.routes.js`
- **Estimated Effort:** 2 hours
- **Risk Level:** LOW

---

## TOP DUPLICATION HOTSPOTS

| File | Duplicate With | Type | Lines Wasted |
|------|---------------|------|--------------|
| admin.controller.js | admin.user.controller.js | Controller | 400+ |
| giftController.js | gift.production.controller.js | Controller | 300+ |
| room.controller.js | room.production.controller.js | Controller | 350+ |
| googleAuthRoutes.js | socialAuthRoutes.js | Routes | 100+ |
| matchmakingSocket.js | matchmakingSocket2.js | Sockets | 200+ |
| redisRankingService.js | redisRankingIntegration.js | Services | 150+ |
| admin.user.controller.js (inline requires) | 8+ other controllers | Pattern | 50+ |

**Total Duplicate/Dead Code:** ~2,000+ lines  
**Estimated Cleanup Effort:** 3-4 days

---

## RECOMMENDATIONS

1. **Immediate (P0):** Fix duplicate route mounts (DUP-005, DUP-006) - 2 hours
2. **Short-term (P1):** Remove duplicate controllers after verifying route usage - 1 day
3. **Medium-term (P2):** Extract common query patterns to repositories - 2 days
4. **Ongoing:** Enforce `no-unused-vars` and `no-duplicate-imports` ESLint rules

---

## CONCLUSION

Duplicate code is **pervasive but manageable**. The god controllers and inline require patterns are the most concerning technical debt. A systematic deduplication sprint paired with service layer extraction will improve maintainability significantly.

**Estimated Deduplication Sprint:** 3-4 days