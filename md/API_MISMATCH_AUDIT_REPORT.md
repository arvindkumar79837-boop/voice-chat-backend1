# API Mismatch Audit Report — Arvind Party Backend

**Date**: 2025-07-31  
**Scope**: Route definitions, controller coverage, validation middleware, response format consistency, status code usage, Swagger/OpenAPI docs  
**Total Route Files**: 76  
**Root**: `src/app.js` mounts all routes under `/api/...`

---

## Executive Summary

The API surface is **large but mostly consistent**: controllers exist for the vast majority of routes, auth is standardized via `authMiddleware`, and success envelopes follow `{ success, data, message }`. **No Swagger/OpenAPI definition was found.** There are **validation gaps** (many routes rely on ad-hoc inline checks instead of shared `validateBody`), **response inconsistencies** (some routes omit `success`, some send 200 for business errors), and **a few structural mismatches** between route files and controller exports.

| Category | Status |
|---|---|
| Routes vs Controllers | 🟢 ~95% matched; a handful of inline handlers or stale controller imports |
| Validation | 🟡 Mixed: some routes use `validateBody`, many use inline checks or none |
| Response Format | 🟢 Mostly consistent `{ success, data, message }`; occasional deviations |
| Status Codes | 🟢 Standard for most; some 200-on-error paths |
| Swagger / OpenAPI | 🔴 None present |
| Frontend Compatibility | 🟢 Clean JSON; no GraphQL or unusual formats |

---

## 1. Route → Controller Mapping

Observations from route file audit (full list of 76 files in `src/routes/`):

- **Clean mappings**: `auth.routes.js`, `healthRoutes.js`, `room.routes.js`, `wallet.routes.js`, `diamondEconomyRoutes.js`, `familyRoutes.js`, `gameRoutes.js`, `chatRoutes.js`, `gift.routes.js`, `pkBattleRoutes.js`, `rankingRoutes.js`, `eventRoutes.js`, `shopRoutes.js`, `tournamentRoutes.js`, `notificationRoutes.js`, `treasureHuntRoutes.js`.
- **Inline handlers present**:
  - `auth.routes.js:90-120` — inline `GET /me` handler.
  - `healthRoutes.js:20-44` and `47-77` — inline `/queues` and `/redis` handlers.
  - `room.routes.js:70-88` — inline `GET /:roomId/members` handler.
  - `adminRoutes.js` — many inline admin aggregations.
- **Mixed controller imports**: `gameRoutes.js` imports **both** `game.controller.js` and `gameController.js`, suggesting legacy aliasing.

**Recommendation**:
- Extract inline handlers into controllers for uniform testing and documentation.
- Document aliased controller mapping in a `ROUTE_MAP.md`.

---

## 2. Validation

Severity breakdown:

| Severity | Location | Issue |
|---|---|---|
| 🟡 MEDIUM | `wallet.routes.js` | `/gift/send` uses `validateBody`, but `/exchange` and `/withdraw/request` rely on controller-level checks; missing `recipientId` format validation. |
| 🟡 MEDIUM | `familyRoutes.js` | `/upgrade` inline route has no validation on `upgradeType` or authorization to ensure caller is family owner. |
| 🟢 OK | `gift.routes.js` | `/send` protected by `giftRateLimit` + `validateBody`. |
| 🟢 OK | `shopRoutes.js` | `/purchase` uses `shopRateLimit`. |
| 🟡 MEDIUM | `webViewGameRoutes.js` | `/games/start-session` and `/end-session` have no body schema validation; `winAmount` is trusted from client. |
| 🟡 MEDIUM | `dealer.routes.js` | `/transfer` has no request body validation middleware; validation inside controller only. |

**Recommendation**:
- Introduce a shared `validateBody` wrapper on all POST/PUT routes.
- Add `express-validator` or Zod schemas for numeric bounds, enum values, and ObjectId format.

---

## 3. Response Format Consistency

Observed patterns:
- **Success**: `{ success: true, data: ..., message?: ... }` — dominant across controllers.
- **Error**: `{ success: false, message: '...' }` — standard.

**Deviations**:
- `healthRoutes.js:84` returns `{ status: 'ready' }` without `success`.
- `healthRoutes.js:86` returns `{ status: 'not ready', reason: ... }` without `success`.
- `room.routes.js:17` returns `{ success: true, members: [] }` while other room endpoints wrap under `data`.
- `familyRoutes.js:17` returns `{ success: true, members: [...] }` while most routes use `data`.
- `gift.routes.js:27-30` returns `{ success: true, gifts }` instead of `{ success: true, data: gifts }`.
- `gift.routes.js:32-41` returns `{ success: true, goal }` instead of `{ success: true, data: goal }`.
- `gift.routes.js:43-46` returns `{ success: true, events: activeEvents }` instead of `data`.
- `auth.routes.js:137-145` returns `{ success: true, data: { role, permissions, name, uid } }` — consistent.
- `webViewGameController` responses use `{ success: true, data: ..., summary: ... }` — consistent.

**Recommendation**:
- Enforce a global response envelope via middleware or a helper:
  `res.success(data, message)` and `res.failure(message, statusCode)`.

---

## 4. Status Code Usage

- **200 OK** — used correctly for most success paths.
- **201 Created** — used in `auth.routes.js` for register, `gift.routes.js` for admin create, etc.
- **400 Bad Request** — present in some inline validation (e.g., `room.routes.js:14`, `familyRoutes.js:41`).
- **401/403** — auth middleware returns these consistently.
- **404/500** — standard in controllers.

**Concern**:
- `gameRoutes.js:10-24` uses `res.json(...)` for stubbed CRUD routes — no explicit status codes, but Express defaults to 200. Acceptable but inconsistent with explicit `res.status(201).json(...)` elsewhere.

**Recommendation**:
- Add explicit status codes on all routes, especially 201 for creation endpoints.

---

## 5. Swagger / OpenAPI

- **None found**. No `swagger-jsdoc`, `swagger-ui-express`, or `openapi` references in the codebase.
- Frontend compatibility is good (clean JSON), but without OpenAPI, client-side code generation and contract testing are impossible.

**Recommendation**:
- Add `swagger-jsdoc` + `swagger-ui-express` and annotate route files with JSDoc comments.

---

## 6. Frontend Compatibility

- **JSON-only responses** — no XML or protobuf. Good for Flutter/React.
- **CORS** configured in `server.js` with allowed origins list.
- **Rate limiting** on auth, gifts, shop, notifications — reduces replay/spam risk for mobile clients.
- **No HATEOAS** — not required for this stack.

---

## 7. Route Coverage Summary

| Module | Routes (approx.) | Validation | Response Consistency | Notes |
|---|---|---|---|---|
| Auth | 7 | `validatePhone`, limiter | Consistent | `/me` inline |
| Health | 5 | None needed | Inconsistent (`status` only) | Probes OK |
| User | 4 | None | Consistent | Search inline |
| Room | ~20 | Mixed | Mostly consistent | Members inline |
| Wallet | ~25 | Mixed | Consistent | Large surface |
| DiamondEconomy | 2 | Auth only | Consistent | |
| Family | ~40 | Mixed | Mostly consistent | `/upgrade` inline, no authZ |
| Game | 8 | Auth only | Consistent | Stubbed CRUD |
| Gift | 12 | Rate limit + body | Mixed (`data` missing) | |
| PK Battle | 3 | Auth only | Consistent | |
| Ranking | 11 | Auth + admin | Consistent | |
| Event | ~20 | Auth + admin | Consistent | |
| Shop | 2 | Rate limit | Consistent | |
| Tournament | ~16 | Auth + admin | Consistent | |
| Notification | 4 | Auth + rate limit | Consistent | |
| Treasure Hunt | 5 | Auth + admin | Consistent | |
| Others | ~30+ | Varies | Mostly consistent | |

---

## 8. Security Concerns Summary

| # | Severity | File | Issue |
|---|---|---|---|
| 1 | 🔴 HIGH | None | No Swagger/OpenAPI — no API contract docs |
| 2 | 🟡 MEDIUM | `familyRoutes.js` | `/upgrade` lacks role check and input validation |
| 3 | 🟡 MEDIUM | `webViewGameRoutes.js` | Client-submitted `winAmount` without server verification |
| 4 | 🟡 MEDIUM | `wallet.routes.js` | Missing schema validation on exchange/withdraw endpoints |
| 5 | 🟡 MEDIUM | `gift.routes.js` | Success responses use `gifts`, `goal`, `events` instead of `data` key |
| 6 | 🟢 LOW | `healthRoutes.js` | Probes return `{ status }` without `success` envelope |

---

## 9. Recommendations Priority

### P0 — Observability
1. **Add Swagger/OpenAPI** — enable API discovery and frontend codegen.

### P1 — Hardening
2. **Standardize validation** — apply `validateBody` to all POST/PUT routes.
3. **Standardize response envelope** — global `res.success` / `res.failure` helpers.
4. **Fix `familyRoutes.js:/upgrade`** — add role check (only owner/patriarch) and body validation.

### P2 — Consistency
5. **Fix gift catalog endpoints** — wrap responses in `{ success, data }`.
6. **Add explicit status codes** on all stubbed/admin CRUD routes.

---

*End of report.*