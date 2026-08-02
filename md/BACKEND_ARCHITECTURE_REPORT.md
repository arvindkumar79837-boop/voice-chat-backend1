# ARVIND PARTY BACKEND - ARCHITECTURE AUDIT REPORT

**Date:** 2026-07-31  
**Focus:** MVC correctness, layer separation, dependency direction, scalability, maintainability

---

## EXECUTIVE SUMMARY

Architecture Score: **55/100** 🟠 **NEEDS REFACTORING**

The codebase follows a loosely-organized MVC pattern with service layer attempts, but suffers from god controllers, circular dependencies, inconsistent layering, and missing repository abstractions. Feature growth has outpaced architectural discipline.

---

## 🔴 CRITICAL ARCHITECTURAL ISSUES

### ARCH-001: God Controller Pattern
- **Severity:** CRITICAL
- **File:** src/controllers/admin.controller.js, admin.user.controller.js
- **Line:** Entire files (379+ lines each)
- **Reason:** Single controllers handle 15+ unrelated operations (users, withdrawals, moments, events, settings). Violates Single Responsibility Principle.
- **Impact:** Code coupling, untestability, merge conflicts, cognitive overload
- **Root Cause:** Feature accretion without refactoring
- **Recommended Fix:** Split into domain controllers: UserAdminController, WithdrawalAdminController, ContentAdminController, SettingsAdminController
- **Estimated Effort:** 12 hours
- **Risk Level:** CRITICAL

### ARCH-002: Circular Dependencies via Inline Requires
- **Severity:** CRITICAL
- **File:** src/controllers/admin.user.controller.js
- **Line:** Multiple (e.g., line 120: `const Withdrawal = require('../models/Withdrawal')`)
- **Reason:** Controllers require models inside methods to avoid top-level circular imports. This is a workaround, not a solution.
- **Impact:** Unpredictable load order, runtime errors, testing difficulty
- **Root Cause:** Tight coupling between controllers and models
- **Recommended Fix:** Introduce repository/service layer to abstract model access
- **Estimated Effort:** 16 hours
- **Risk Level:** HIGH

### ARCH-003: Missing Service Layer Abstraction
- **Severity:** HIGH
- **File:** src/controllers/*.js
- **Line:** Throughout
- **Reason:** Controllers call models directly instead of through service/repository interfaces. Business logic leaks into controllers.
- **Impact:** Cannot swap implementations, no transaction boundaries, duplicated validation
- **Root Cause:** Service layer inconsistently applied (some exist, most don't)
- **Recommended Fix:** Create service classes for each domain: UserService, GiftService, RoomService, etc.
- **Estimated Effort:** 40 hours
- **Risk Level:** HIGH

---

## 🟠 HIGH SEVERITY ISSUES

### ARCH-004: Inconsistent File Naming Conventions
- **Severity:** HIGH
- **File:** Multiple
- **Line:** Throughout
- **Reason:** Mix of `camelCase` (auth.controller.js), `PascalCase` (User.js), `dot.notation` (anti.spam.service.js), and `dash-case` (level.routes.js).
- **Impact:** Developer confusion, import errors, tooling breaks
- **Root Cause:** No linting rules enforcing conventions
- **Recommended Fix:** Enforce naming via ESLint: `kebab-case` for routes, `PascalCase` for models, `camelCase` for everything else
- **Estimated Effort:** 4 hours
- **Risk Level:** MEDIUM

### ARCH-005: Socket-Controller Duplication
- **Severity:** HIGH
- **File:** src/sockets/*.js vs src/controllers/*.js
- **Line:** Throughout
- **Reason:** Business logic duplicated between socket handlers and controllers. E.g., gift sending exists in both `giftSocket.js` and `gift.production.controller.js`.
- **Impact:** Bug fixes applied twice, inconsistent validation
- **Root Cause:** No shared service layer for cross-platform logic
- **Recommended Fix:** Extract domain logic into services called by both HTTP and socket handlers
- **Estimated Effort:** 20 hours
- **Risk Level:** HIGH

### ARCH-006: No Repository Pattern
- **Severity:** HIGH
- **File:** src/controllers/*.js
- **Line:** Throughout
- **Reason:** Direct Mongoose calls scattered everywhere. No abstraction for:
  - Query building
  - Pagination
  - Projection
  - Transaction management
- **Impact:** Schema changes break 20+ controllers, no centralized optimization
- **Root Cause:** Missing architectural layer
- **Recommended Fix:** Implement repository classes: `UserRepository`, `GiftRepository` with common methods
- **Estimated Effort:** 24 hours
- **Risk Level:** HIGH

---

## 🟡 MEDIUM SEVERITY ISSUES

### ARCH-007: Configuration Scattering
- **Severity:** MEDIUM
- **File:** src/config/*.js, src/utils/*.js, src/services/*.js
- **Line:** Multiple
- **Reason:** Configuration logic spread across config files, service files, and utils. No centralized config validation.
- **Impact:** Hard to override settings, no defaults enforcement
- **Root Cause:** Ad-hoc configuration
- **Recommended Fix:** Use `convict` or `zod` for schema-validated config
- **Estimated Effort:** 6 hours
- **Risk Level:** MEDIUM

### ARCH-008: Missing Domain Events
- **Severity:** MEDIUM
- **File:** src/services/*.js
- **Line:** Throughout
- **Reason:** No event-driven architecture. Cron jobs directly call controllers instead of emitting events.
- **Impact:** Tight coupling, no audit trail for side effects
- **Root Cause:** Procedural style
- **Recommended Fix:** Introduce event emitter pattern: `eventBus.emit('user.created', user)`
- **Estimated Effort:** 12 hours
- **Risk Level:** MEDIUM

### ARCH-009: God Object in Room Model
- **Severity:** MEDIUM
- **File:** src/models/Room.js
- **Line:** 406 lines
- **Reason:** Room schema contains PK battle config, task lists, cosmetics, seat arrays, power matrix refs. Should be split into subdocuments or linked models.
- **Impact:** Large documents, slow queries, schema migration pain
- **Root Cause:** Monolithic schema design
- **Recommended Fix:** Extract RoomPK, RoomTask, RoomCosmetic as separate collections
- **Estimated Effort:** 16 hours
- **Risk Level:** MEDIUM

### ARCH-010: No Transaction Boundaries
- **Severity:** MEDIUM
- **File:** Multiple controllers
- **Line:** Throughout
- **Reason:** Operations that modify multiple collections (e.g., gift send + wallet deduction + notification) lack MongoDB transactions.
- **Impact:** Partial failures, data inconsistency
- **Root Cause:** No transaction wrapper utility
- **Recommended Fix:** Create `runInTransaction()` helper and apply to multi-doc operations
- **Estimated Effort:** 8 hours
- **Risk Level:** MEDIUM

---

## 🟢 LOW SEVERITY ISSUES

### ARCH-011: Hardcoded Service References
- **Severity:** LOW
- **File:** src/services/*.js
- **Line:** Multiple
- **Reason:** Services import other services directly. No dependency injection for testing.
- **Impact:** Cannot mock dependencies in unit tests
- **Root Cause:** No DI container
- **Recommended Fix:** Use `awilix` or manual DI for testability
- **Estimated Effort:** 8 hours
- **Risk Level:** LOW

### ARCH-012: Mixed Async Patterns
- **Severity:** LOW
- **File:** src/middlewares/*.js, src/controllers/*.js
- **Line:** Throughout
- **Reason:** Mix of async/await, Promises, and callbacks (especially in socket handlers).
- **Impact:** Inconsistent error handling, unhandled rejections
- **Root Cause:** Evolutionary growth
- **Recommended Fix:** Standardize on async/await with `catchAsync` wrapper
- **Estimated Effort:** 4 hours
- **Risk Level:** LOW

---

## LAYER VIOLATIONS

| Layer | Should Depend On | Actually Depends On | Violations |
|-------|-----------------|---------------------|------------|
| **Routes** | Controllers | Controllers + direct model access | 20+ routes call models directly |
| **Controllers** | Services | Models + Services mixed | 40/53 controllers use models directly |
| **Services** | Repositories | Models + other services | 18/21 services import models |
| **Models** | Nothing | Other models via refs | Acceptable (Mongoose) |
| **Sockets** | Services | Models + controllers | 15/17 socket files import models |

---

## DEPENDENCY GRAPH (Simplified)

```
app.js
  ├─ routes/* (56 files)
  │   └─ controllers/* (53 files)
  │       ├─ models/* (113 files) ← VIOLATION: should go through services
  │       └─ services/* (21 files)
  └─ sockets/* (17 files)
      ├─ models/* (113 files) ← VIOLATION: should go through services
      └─ controllers/* (53 files) ← VIOLATION: circular dependency risk
```

---

## DESIGN PATTERNS OBSERVED

| Pattern | Status | Notes |
|---------|--------|-------|
| **MVC** | Partial | Controllers fat, models anemic |
| **Service Layer** | Inconsistent | 21 services exist, but controllers bypass them |
| **Repository** | Missing | Direct Mongoose everywhere |
| **Factory** | Partial | Some model factories in seeds (not audited) |
| **Observer** | Partial | Socket events but no central event bus |
| **Middleware** | Good | Auth, validation, error handling well structured |
| **Singleton** | Good | Redis, DB, IO singletons properly scoped |

---

## SCALABILITY CONCERNS

1. **Monolithic Deployment** - All features in one process. Cannot scale features independently.
2. **No Circuit Breakers** - External calls (Firebase, Cloudinary, LiveKit) lack timeouts/retries.
3. **Shared State** - Socket.IO in-memory adapter prevents horizontal scaling.
4. **Tight Coupling** - Cron jobs require controller modules, increasing memory footprint.

---

## RECOMMENDED REFACTORING ROADMAP

**Phase 1 (Weeks 1-2): Extract Services**
- Move all business logic from controllers to services
- Introduce UserService, GiftService, RoomService
- **Impact:** Testability, reusability

**Phase 2 (Weeks 3-4): Introduce Repositories**
- Create repository classes for each aggregate root
- Controller → Service → Repository → Model
- **Impact:** Query optimization centralization, transaction safety

**Phase 3 (Weeks 5-6): Domain Events**
- Replace direct controller calls from crons/sockets with events
- Implement lightweight event bus
- **Impact:** Loose coupling, auditability

**Phase 4 (Weeks 7-8): Modularization**
- Split into npm packages or microservices:
  - `@arvind/core` (User, Auth)
  - `@arvind/gifting` (Gift, Wallet)
  - `@arvind/rooms` (Room, PKBattle)
  - `@arvind/social` (Family, Social)
- **Impact:** Independent deployability

---

## CONCLUSION

Architecture is **functional but accumulating technical debt**. The lack of service/repository layers is the root cause of most maintainability issues. Prioritize service extraction to unlock testability and scaling.

**Estimated Refactoring Effort:** 6-8 weeks