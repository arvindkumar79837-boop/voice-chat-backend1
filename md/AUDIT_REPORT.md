# 🕵️‍♂️ FORENSIC AUDIT REPORT — ARVIND PARTY BACKEND
**Date:** 2026-07-31
**Scope:** package.json, server.js, src/app.js, ecosystem.config.js, Dockerfile, docker-compose.yml, .env.example (+ supporting config/middleware files)
**Read-Only Forensic Audit**

---

## ⚠️ NOTE ON package-lock.json
The `package-lock.json` file **does not exist** in the project root (confirmed via filesystem search). This is itself a critical finding documented below.

---

# 1. PROJECT ARCHITECTURE

## Overview
- **Framework:** Node.js (Express 4.x) — monolith server with Socket.IO for real-time
- **Database:** MongoDB via Mongoose ODM (8.x)
- **Cache/Queue:** Redis via `ioredis` (for OTP) + `redis` (for rankings) + `bullmq` (task queues)
- **Real-time:** Socket.IO 4.x for multiplayer game state, voice rooms, chat
- **Video/Voice:** LiveKit SDK integration
- **Auth:** JWT (access+refresh tokens), Google OAuth, Apple Sign-In, Firebase Admin SDK
- **Media:** Cloudinary + Sharp image processing
- **Payments:** Google Play IAP verification (via google-auth-library)
- **AI Features:** OpenAI SDK integration
- **Deployment:** PM2 (cluster mode) + Docker + Docker Compose + (optional) AWS Auto Scaling
- **Monitoring:** Prometheus + Grafana (optional); custom MonitoringService

## Folder Structure Analysis
```
voice-chat-backend1/
├── server.js                    # Entry point: HTTP + Socket.IO + Cron jobs
├── src/
│   ├── app.js                   # Express application (all middleware + ~75 route mounts)
│   ├── config/
│   │   ├── cors.js              # CORS whitelist
│   │   ├── db.js                # MongoDB connection w/ reconnect
│   │   ├── redis.js             # Redis client
│   │   ├── socket.js            # Socket.IO singleton
│   │   ├── jwt.js               # Token expiry constants
│   │   └── firebase*.js
│   ├── middlewares/
│   │   ├── auth.middleware.js   # JWT verification + RBAC + 2FA
│   │   ├── security.middleware.js # Device/IP/VPN lockdown
│   │   ├── rate limiters in app.js
│   │   ├── errorHandler.middleware.js
│   │   └── request-logger.middleware.js
│   ├── controllers/
│   ├── services/
│   ├── models/
│   ├── routes/
│   ├── sockets/
│   ├── workers/                 # AnalyticsWorker, GiftQueueWorker (BullMQ)
│   └── utils/
├── tests/
├── Dockerfile
├── docker-compose.yml
├── ecosystem.config.js
└── .env.example
```

## Assessment
The architecture is a **large, mature monolith** with significant breadth (gaming, payments, social, dating, live streaming, economy). It has clear modular separation of concerns but the monolith is approaching the complexity where modularization or microservice splitting would be warranted. The codebase has evidence of a multi-phase development effort (P1, P2-10 references in `.env.example`).

The sheer number of route mounts (75+) in `src/app.js` lines 12-87 indicates a **highly coupled monolith** with tight integration of domains that could benefit from modular route registration (e.g., a route loader pattern iterating over a directory).

---

# 2. DEPENDENCIES

## Key Dependencies (package.json lines 15-45)

| Category | Package | Version | Notes |
|---|---|---|---|
| Framework | express | ^4.21.2 | Stable, but v5 is available |
| Real-time | socket.io | ^4.7.5 | Good |
| Database | mongoose | ^8.24.1 | Latest major |
| Cache | ioredis | ^5.4.1 | Good — but **dual Redis client** (ioredis + redis) is redundant |
| Cache (rankings) | redis | ^4.6.13 | **Redundant** with ioredis — see issue |
| Auth | jsonwebtoken | ^9.0.2 | Good |
| Auth | bcryptjs | ^2.4.3 | **Weak** — should use `bcrypt` (native) for performance |
| Auth | firebase-admin | ^12.0.0 | Good |
| Video | livekit-server-sdk | ^2.15.5 | Good |
| Image | sharp | ^0.35.3 | Good |
| Media | cloudinary | ^2.7.0 | Good |
| Queue | bullmq | ^1.19.0 | Good |
| Validation | express-validator | ^7.0.0 | Good |
| Rate limiting | express-rate-limit | ^7.1.5 | Good |
| Security | helmet | ^7.1.0 | Good |
| Security | cors | ^2.8.5 | Good |
| Security | speakeasy | ^2.0.0 | TOTP 2FA |
| Monitoring | @sentry/node | ^10.62.0 | Good |
| Scheduling | node-cron | ^4.5.0 | Good |

## Assessment
- **Dual Redis libraries** (`ioredis` ^5.4.1 + `redis` ^4.6.13): The project imports `ioredis` for OTP service and `redis` for ranking service. This is **redundant** and increases bundle size + maintenance surface. Should consolidate.
- **`bcryptjs`** instead of native `bcrypt`: `bcryptjs` is pure-JS and ~2-3x slower. For a high-traffic gaming backend, this impacts login latency. Native `bcrypt` is recommended.
- **Chalk ^4.1.2** in dependencies (not dev): chalk is a dev-only utility; bundling it in production deps is unnecessary bloat.
- **Agora SDK** (`agora-access-token`) present — likely legacy, given LiveKit is the primary video stack. Worth auditing for dead code.

---

# 3. STARTUP FLOW

## server.js (444 lines)

1. **Env loading** (lines 1-13): Attempts `.env` file; falls back to `dotenv.config()`. Validates 4 required vars (JWT_SECRET, REFRESH_TOKEN_SECRET, MONGO_URI, PORT) — exits(1) if missing.
2. **HTTP server + Socket.IO** (lines 37-68): `http.createServer(app)`, `new Server(io)` with CORS config mirroring `src/config/cors.js`.
3. **Workers** (lines 74-85): `AnalyticsWorker` starts.
4. **Cron jobs** (lines 95-154): 4 scheduled jobs:
   - Monthly salary calculation (line 95)
   - Agency target expiry check (line 121)
   - Subscription expiry (line 134)
   - Blind Date queue processor — fires **every 3 seconds** (line 147) ⚠️
5. **Service initialization** (lines 157-350): Async IIFE initializes MongoDB, Redis (x2), Firebase, Badges, VIP cosmetics, Power Matrix, Event Scheduler, BullMQ Queue + Gift Worker, Monitoring, Media Storage, CDN, Auto Scaling, Backup, Sentry, Audit, Health Alert, Deployment, Feature Flags.
6. **Graceful shutdown** (lines 352-408): SIGTERM/SIGINT handlers, unhandled rejection + uncaught exception handlers.
7. **Server listen** (lines 414-442): Port fallback logic (port+1 if EADDRINUSE).

## Assessment
- The **3-second cron** (`*/3 * * * * *`) is extremely aggressive and will spawn concurrent executions. Node-cron does not guarantee sequential execution; without a locking mechanism, `blindDateController.processQueue()` could run multiple times concurrently, leading to duplicate processing.
- **Cron jobs are registered BEFORE service initialization completes** (line 95 registers cron before MongoDB connects at line 161). If a cron fires before MongoDB is connected, it will throw. The try/catch in cron body prevents crash, but silently fails.
- Service init is **fire-and-forget with individual try/catch** (lines 157-350): Each service is isolated. This is resilient but means the server can start in a partially functional state without clear health visibility.
- `process.exit(1)` on **uncaughtException** (line 407): This is correct for production (fail-fast), but `unhandledRejection` does NOT exit (line 401) — it only logs. This is an inconsistency.

---

# 4. MIDDLEWARE ORDER

## src/app.js (277 lines)

| Order | Middleware | Line | Assessment |
|---|---|---|---|
| 1 | `trust proxy = 1` | 91 | ✅ Good for proxies |
| 2 | Request ID generation | 95-99 | ✅ Tracing |
| 3 | `helmet()` | 102 | ✅ Security headers |
| 4 | `requestLoggerMiddleware` | 103 | ⚠️ Should be **after** JSON parsers for body size logging |
| 5 | `corsConfig` | 104 | ✅ |
| 6 | `express.json(10mb)` | 107 | ✅ |
| 7 | `express.urlencoded(10mb)` | 108 | ✅ |
| 8 | `apiLimiter` (200/15min) | 111-116 | ✅ |
| 9 | `authLimiter` (5/15min) | 119-124 | ✅ On auth routes |
| 10 | `otpLimiter` (5/5min) | 126-131 | ✅ On OTP routes |
| 11 | Route mounts (125+ routes) | 134-260 | ✅ |
| 12 | 404 handler | 266-272 | ✅ |
| 13 | `errorHandler` | 275 | ✅ Last |

## Assessment
- **Request logger (line 103) is placed BEFORE body parsers (lines 107-108)**. This means the request body is not yet parsed when the logger captures the request. While the logger only logs method/path/status, this is a minor concern. More importantly, if a large body exceeds 10mb, the error from body parser will not be caught by the request logger's wrapper. **Recommendation:** move requestLogger **after** body parsers.
- **`helmet()` runs before CORS**. This is fine — Helmet doesn't conflict with CORS. But Helmet's `crossOriginOpenerPolicy` and `crossOriginEmbedderPolicy` are not set.
- **Rate limiters come AFTER CORS but the auth rate limiter does NOT apply to all auth routes** — line 159 (`/api/auth/social`) is NOT rate limited, and line 161 applies authLimiter again to firebaseAuthRoutes (duplicate with line 156).

---

# 5. EXPRESS CONFIGURATION

## src/app.js line 89-116

- `app.set('trust proxy', 1)` — Correct for single-proxy (Docker/Nginx).
- `app.set('io', io)` — Set in server.js line 71; makes io accessible in controllers. Acceptable pattern.
- **No `app.set('strict routing')`** — Routes are case-sensitive by default; `/API/auth` would 404. Acceptable but worth documenting.
- **No `app.set('x-powered-by', false)`** — Helmet handles this by default. ✅

## Assessment
- Express config is **minimal and standard**. No misconfigurations found.
- Body limits of `10mb` are reasonable for Base64 image uploads but could be a DoS vector if not rate-limited per user. The global `apiLimiter` (200 req/15min) provides some protection.

---

# 6. ENVIRONMENT VARIABLES

## .env.example (159 lines) — Analysis

### Required (documented in server.js line 18-23):
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `MONGO_URI`
- `PORT`

### Missing from .env.example:
- `SECRET_TOKEN_SECRET` — not present (good, only 2 token secrets)
- **`REDIS_PASSWORD`** — present but empty (line 30)
- **`TWILIO_*`** — present in docker-compose (lines 66-68) but **NOT in .env.example** ⚠️
- **`MONGO_ROOT_USERNAME` / `MONGO_ROOT_PASSWORD`** — present in docker-compose (lines 9-10) but **not fully documented in .env.example** (lines 140-141 have them as optional, but they're used in the MONGO_URI construction for Docker)

### Validation:
- server.js validates only 4 vars (lines 18-23). `FIREBASE_*`, `GOOGLE_PLAY_*`, `LIVEKIT_*`, `SENTRY_DSN` are NOT validated at startup — they fail silently if misconfigured. This is **by design** (optional services) but means production could run with broken IAP verification without alerting.

## Assessment
- `.env.example` is comprehensive (159 lines).
- **Critical gap:** `TWILIO_*` variables are used in docker-compose.yml (lines 66-68) but missing from `.env.example`. A developer following the guide would not know to set them.
- `JWT_SECRET` default is `your_jwt_secret_here` (line 10) — this is a placeholder, but if a developer runs with this, JWT is unsigned-weak. No enforcement of minimum length/entropy.

---

# 7. SECURITY HEADERS (Helmet)

## src/app.js line 102: `app.use(helmet())`

### Default Helmet v7 Headers Applied:
- `Content-Security-Policy` ✅
- `X-Content-Type-Options: nosniff` ✅
- `X-Frame-Options: DENY` (via `frameguard`) ✅
- `Strict-Transport-Security` ✅ (only over HTTPS — helmet detects protocol)
- `Referrer-Policy` ✅
- `X-XSS-Protection: 0` ✅ (disabled — correct for modern browsers)
- `Hide-Powered-By: true` ✅
- `Cross-Origin-Resource-Policy: same-origin` ✅
- `Cross-Origin-Opener-Policy: same-origin` ✅
- `Origin-Agent-Cluster: ?1` ✅

### Assessment
- **No custom Helmet configuration.** The defaults are reasonable but:
  - `Content-Security-Policy` is permissive (default-src 'self') — no inline scripts/styles are used in an API, so this is fine.
  - `Strict-Transport-Security` only applies when behind HTTPS (helmet auto-detects). In Docker, the backend talks HTTP; HSTS would only activate if proxied behind TLS-terminating Nginx. **Ensure Nginx sets X-Forwarded-Proto.**
  - No `X-Permitted-Cross-Domain: none` — Helmet v7 enables this by default via `crossOriginResourcePolicy`. ✅

---

# 8. CORS

## src/config/cors.js

### Configuration (lines 40-72):
- **Origin:** Whitelist-based with environment detection. Production allows 4 domains (lines 18-23). Dev allows localhost + LAN IPs.
- **Credentials:** `true` ✅
- **Methods:** Full REST set ✅
- **Allowed Headers:** Includes `x-staff-role`, `x-staff-id`, `x-access-token` — these are custom headers for staff API. ✅
- **Exposed Headers:** `Content-Range`, `X-Content-Range`, `X-Total-Count` — useful for paginated admin endpoints. ✅
- **MaxAge:** 86400 (24h) ✅
- **optionsSuccessStatus:** 200 ✅

### ⚠️ Security Concern (lines 46-56):
In production, **any request with no Origin header is allowed** (`callback(null, true)`). The comment (lines 46-54) justifies this for mobile apps (which don't send Origin). However:
- This means **any non-browser client** (curl, Postman, custom scripts) can bypass CORS in production.
- The mitigation relies on JWT auth — but **public endpoints** (rate-limited auth endpoints, health, welcome) accept unauthenticated requests and would be exploitable from anywhere with no Origin.
- An attacker could use this to **brute-force auth endpoints** from server-side scripts without CORS restrictions.

### Socket.IO CORS (server.js lines 49-67):
- Mirrors the same permissive no-origin policy. ✅/⚠️ (same concern)

## Assessment
The CORS config is **reasonable for a mobile-first API** but the **blanket allow-no-origin in production** is a notable risk. It is mitigated by JWT auth, but public endpoints remain exposed.

---

# 9. COMPRESSION

## 🔴 CRITICAL MISSING — NO COMPRESSION MIDDLEWARE FOUND

### Evidence:
- `src/app.js` — searched all 277 lines. **No `express.json` compression, no `compression()` middleware.**
- `package.json` — **`compression` is NOT in dependencies** (lines 15-45).
- `server.js` — no compression setup.

### Impact:
- All API responses (JSON, potentially large payloads with user profiles, game state, etc.) are sent uncompressed.
- For mobile users on high-latency / metered connections, this **significantly increases latency and bandwidth cost**.
- JSON payloads for game state, inventory, etc. could be 70-90% larger than gzip-compressed equivalents.

### Fix:
1. Install: `npm install compression`
2. Add to `src/app.js` after body parsers (line 108):
   ```js
   const compression = require('compression');
   app.use(compression({ threshold: 1024, filter: compression.filter });
   ```
3. Add `compression` to `package.json` dependencies.

---

# 10. LOGGING

## src/utils/logger.js (98 lines) — Winston-based

### Strengths:
- **Structured logging** with timestamp, level, message, metadata.
- **Production:** JSON format (line 26) ✅
- **Dev:** Colorized, human-readable format ✅
- **File transports:** `error.log` (10MB, 5 files), `combined.log` (20MB, 10 files) ✅
- **Exception + rejection handlers** to file ✅
- **Log level** configurable via `LOG_LEVEL` env var (line 21) ✅
- **Environment-gated debug** via `DEBUG_LOGS`, `API_LOGS`, `HTTP_LOGS`, `DB_LOGS` (lines 70, 81, 87, 93) ✅
- **Test-silent** in test environment (line 37) ✅

### request-logger.middleware.js (23 lines):
- Captures method, path, status, duration, IP. ✅
- Uses `res.end` monkey-patch (line 14) — works but slightly fragile. More robust: use `on-finished` package.

### server.js:
- Heavy use of `console.log`/`console.warn`/`console.error` (lines 7, 28, 34, etc.) — **inconsistent with Winston Logger**. The bootstrap phase uses console before Logger is loaded, but this pattern persists throughout. This creates **two logging systems**.

### Assessment
- **Winston is well-configured** for production.
- **Inconsistency:** server.js uses `console.log` extensively (40+ instances) instead of the imported `Logger`. This means bootstrap messages are NOT structured, NOT rotated, and NOT captured in `combined.log`.
- **No log rotation** is configured in PM2 or Docker — relies on Winston file transport rotation (maxsize/maxFiles). ✅

---

# 11. RATE LIMITING

## src/app.js lines 111-131

### Global API Limiter (lines 111-116):
- 200 requests per 15 min per IP ✅

### Auth Limiter (lines 119-124):
- 5 requests per 15 min in production, 1000 in dev ✅
- `skipSuccessfulRequests` in dev ✅

### OTP Limiter (lines 126-131):
- 5 requests per 5 min in production ✅

### Assessment
- **Rate limiting is present and well-configured for auth/OTP.**
- **No rate limiting on the Blind Date queue processor cron** — fires every 3 seconds. While not an HTTP endpoint, this could be a resource exhaustion vector if `processQueue` is CPU/IO heavy.
- **Socket.IO connections have NO rate limiting.** A malicious client could open thousands of socket connections. `maxConnections` is not set on the Socket.IO server (server.js lines 48-67).
- **Rate limiter does not use a store.** `express-rate-limit` v7 uses `MemoryStore` by default. In PM2 cluster mode (ecosystem.config.js line 7: `instances: 'max'`), each worker has its own in-memory store — meaning the rate limit is **per-worker, not per-application**. With 4+ workers, the effective rate limit is multiplied. Should use `RedisStore` (e.g., `rate-limit-redis`) for distributed rate limiting.

---

# 12. PRODUCTION READINESS

## 🟡 Score: ~72/100 — Solid foundation with several critical gaps

## Checklist:

| Item | Status | Evidence |
|---|---|---|
| Graceful shutdown (signal handlers) | ✅ | server.js lines 352-408 |
| Health check endpoint | ✅ | src/app.js line 144 `/health`; Dockerfile line 47, docker-compose line 81 |
| DB auto-reconnect | ✅ | src/config/db.js lines 69-89 (exponential backoff) |
| Redis fallback | ✅ | server.js lines 168-179 (continues without Redis) |
| PM2 cluster mode | ✅ | ecosystem.config.js lines 4, 6 (`instances: 'max'`, `exec_mode: 'cluster'`) |
| Max memory restart | ✅ | ecosystem.config.js line 10 (`max_memory_restart: '1G'`) |
| Docker multi-stage | ✅ | Dockerfile stages 1-2 |
| Docker non-root user | ✅ | Dockerfile line 41 (`USER nodejs`) |
| Docker dumb-init | ✅ | Dockerfile line 57 |
| Docker healthcheck | ✅ | Dockerfile line 47, docker-compose line 81 |
| `.env` validation | ✅ | server.js lines 18-35 |
| Sentry error tracking | ✅ | @sentry/node in deps; errorReportingService |
| Prometheus metrics | ✅ | prometheus.yml, optional compose service |
| Backup service | ✅ | docker-compose `backup` service (lines 87-106) + server.js (lines 288-299) |
| Auto-scaling hooks | ✅ | server.js lines 274-285; AWS env vars |

### 🔴 Issues impacting production readiness:

1. **No `package-lock.json`** — Reproducible builds are **impossible**. `npm ci` in Dockerfile (line 11, 33) would **FAIL** without package-lock.json. This is a **critical deployment blocker**.

2. **Dockerfile `target: production`** (docker-compose line 48) — The Dockerfile has no `target: production` stage defined. It has `builder` and a final `FROM node:18-alpine` stage. The `target: production` directive in docker-compose would fail to resolve. ⚠️

3. **Helmet CSP is default** — No custom CSP. For an API this is fine, but if any front-end is ever served, it's permissive.

4. **`express-rate-limit` uses MemoryStore** in cluster mode — rate limits are ineffective across workers (see §11).

5. **3-second cron job** runs concurrently without locking — production stability risk.

6. **No `compression` middleware** — performance impact.

7. **server.js uses `console.log`** instead of Winston Logger — logging is inconsistent in production.

---

# FINAL SCORE: 72 / 100

## 🔴 CRITICAL ISSUES

### 1. Missing `package-lock.json`
- **File:** `package-lock.json` (not found)
- **Evidence:** Filesystem search confirmed absence. Dockerfile line 11 and 33 run `npm ci --only=production` which **requires** `package-lock.json`. Without it, Docker builds **fail**.
- **Impact:** Production Docker deployment is **broken**. CI/CD pipelines will fail. Dependency versions are non-reproducible.
- **Fix:** Run `npm install` locally to generate `package-lock.json`, commit it. Add to CI pipeline verification.

### 2. No Compression Middleware
- **File:** `src/app.js` (lines 1-277)
- **Evidence:** No `compression()` middleware anywhere. `compression` not in `package.json` dependencies (lines 15-45).
- **Impact:** All API responses sent uncompressed. Significant latency/bandwidth for mobile users. Performance degradation of 50-90% on JSON payloads.
- **Fix:** Install `compression`, add `app.use(compression())` in `src/app.js` after body parsers.

### 3. Dockerfile Build Target Mismatch
- **File:** `docker-compose.yml` line 48
- **Evidence:** `target: production` specified, but Dockerfile only defines stages `builder` (line 2) and final unnamed stage (line 14, `FROM node:18-alpine`) — no stage named `production`.
- **Impact:** `docker compose build` fails with "stage 'production' not found".
- **Fix:** Either remove `target: production` from docker-compose (line 48) or rename the final Dockerfile stage to `AS production`.

### 4. No Rate Limiting Store (MemoryStore in Cluster)
- **File:** `src/app.js` lines 111-131
- **Evidence:** `express-rate-limit` v7 uses `MemoryStore` by default. PM2 runs in cluster mode (`ecosystem.config.js` line 7 `instances: 'max'`). Each worker has independent in-memory rate limit counters.
- **Impact:** With 4-8 workers, effective rate limit is 4x-8x the configured limit. Auth brute-force protection is weakened.
- **Fix:** Install `rate-limit-redis` and configure with the Redis client.

## 🟠 HIGH ISSUES

### 5. Blanket No-Origin Allow in Production CORS
- **File:** `src/config/cors.js` lines 46-56; `server.js` lines 49-67
- **Evidence:** Any request with no `Origin` header is accepted in production. Comment acknowledges mobile apps don't send Origin (lines 43-45).
- **Impact:** Non-browser clients (curl, scripts, bots) bypass CORS entirely on public endpoints. Combined with JWT-less public routes, this enables unauthenticated brute-force.
- **Fix:** Remove the `production` branch that returns `true` for missing origin. Instead, maintain a strict whitelist. For mobile, implement origin-independent auth (JWT already covers this). Consider using a reverse proxy / WAF to filter non-mobile User-Agents.

### 6. Dual Redis Client Libraries
- **File:** `package.json` lines 21 (`ioredis` ^5.4.1), line 40 (`redis` ^4.6.13)
- **Evidence:** `src/config/redis.js` uses `redis` package. OTP service uses `ioredis`. Two separate Redis client instances maintained.
- **Impact:** Redundant dependency, increased bundle size, maintenance overhead, potential for inconsistent connection states.
- **Fix:** Consolidate to a single Redis library (prefer `ioredis` for its richer feature set including built-in cluster support and reconnection handling).

### 7. Aggressive 3-Second Blind Date Cron Without Locking
- **File:** `server.js` lines 147-154
- **Evidence:** `cron.schedule('*/3 * * * * *', ...)` — fires every 3 seconds. Node-cron does not deduplicate concurrent runs if `processQueue` takes >3s.
- **Impact:** Overlapping executions could cause duplicate Blind Date matches, race conditions on user state, database contention.
- **Fix:** Implement a distributed lock (Redis-based) at the start of `processQueue`. Or increase interval to 10-30 seconds with batch processing.

### 8. Cron Jobs Registered Before Service Initialization
- **File:** `server.js` lines 95-154 (cron registration) vs lines 157-350 (service init including MongoDB)
- **Evidence:** Cron jobs for salary, targets, subscriptions, blind dates are registered at lines 95-154. MongoDB connects at line 161. If a cron fires before DB is connected, the `try/await` in cron body catches the error silently.
- **Impact:** First invocation of each cron may be silently dropped. Monthly salary cron (runs on 1st of month) could fail if DB isn't connected yet.
- **Fix:** Move cron registration to AFTER service initialization completes, or add a `mongoose.connection.readyState === 1` guard inside each cron.

### 9. bcryptjs Instead of Native bcrypt
- **File:** `package.json` line 20 (`bcryptjs` ^2.4.3)
- **Evidence:** `bcryptjs` is pure JavaScript — significantly slower than native `bcrypt` which uses C++ bindings.
- **Impact:** Login and registration endpoints are slower under load. For a gaming app with concurrent users, this is a performance bottleneck.
- **Fix:** Replace `bcryptjs` with `bcrypt`. Run `npm uninstall bcryptjs && npm install bcrypt`. Update import in auth utilities.

## 🟡 MEDIUM ISSUES

### 10. Inconsistent Logging (console.log vs Winston)
- **File:** `server.js` (42+ instances throughout lines 1-444)
- **Evidence:** Bootstrap and service init uses `console.log`/`console.warn`/`console.error` (e.g., lines 7, 28, 34, 82, 84, 114, etc.). `Logger` (Winston) is imported in `src/app.js` (line 9) and used in config/middleware files but NOT in `server.js`.
- **Impact:** Bootstrap logs are unstructured, not captured in `combined.log`, not JSON-formatted in production. Makes log correlation and debugging harder.
- **Fix:** Import and use the Winston `Logger` in `server.js` throughout. Replace all `console.log`/`console.error` calls.

### 11. Request Logger Placed Before Body Parsers
- **File:** `src/app.js` lines 102-108
- **Evidence:** `requestLoggerMiddleware` (line 103) is registered before `express.json()` (line 107) and `express.urlencoded()` (line 108).
- **Impact:** The logger wraps `res.end` but runs before the body is parsed. If body parsing fails (e.g., payload too large), the error propagates unhandled. Minor issue since errorHandler catches it, but logging order is suboptimal.
- **Fix:** Move `requestLoggerMiddleware` (line 103) to after body parsers (after line 108).

### 12. TWILIO Variables Missing from .env.example
- **File:** `docker-compose.yml` lines 66-68 vs `.env.example` (no TWILIO entries)
- **Evidence:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` are passed to the backend container in docker-compose.yml but have no entries in `.env.example`.
- **Impact:** Developer follows setup guide, starts with `docker compose up`, SMS/OTP functionality silently fails. No error at startup (since not in required env validation per server.js line 18-23).
- **Fix:** Add TWILIO entries to `.env.example`.

### 13. JWT_SECRET Has No Minimum Entropy Enforcement
- **File:** `server.js` lines 18-23; `.env.example` lines 10-11
- **Evidence:** Required env validation only checks for presence (`!process.env[key]`), not for strength. Default value in `.env.example` is `your_jwt_secret_here` (line 10).
- **Impact:** Developer copies `.env.example`, runs `npm run start`, JWT is signed with a trivially guessable secret. Entire auth system is compromised.
- **Fix:** Add entropy check: reject if `JWT_SECRET.length < 32`. Fail fast with a clear message.

### 14. Socket.IO No Connection Limits
- **File:** `server.js` lines 48-67
- **Evidence:** Socket.IO server configured with `transports`, `cors`, reconnection settings — but no `maxHttpBufferSize`, `maxConnections`, or `connectionTimeout` limits.
- **Impact:** A malicious client can open unlimited socket connections or send oversized payloads, causing resource exhaustion.
- **Fix:** Add `maxConnections`, `maxHttpBufferSize: 5e6` (5MB), `connectionTimeout: 5000` to Socket.IO options.

## 🟢 LOW ISSUES

### 15. Duplicate authLimiter Application
- **File:** `src/app.js` lines 156, 161
- **Evidence:** Line 156 applies `authLimiter` to `/api/auth`. Line 161 applies `authLimiter` to `/api/auth` **again** for Firebase routes. Express applies middlewares in order — both rate limiters fire on Firebase auth routes.
- **Impact:** Negligible — both are the same limiter. But code smell suggests lack of review.

### 16. No Content Security Policy Custom Config
- **File:** `src/app.js` line 102
- **Evidence:** `helmet()` with no options. Default CSP is `default-src 'self'`.
- **Impact:** For an API-only backend, this is acceptable. If the backend ever serves HTML, the CSP would need tightening.
- **Fix:** Document that this is an API-only service; CSP is a no-op concern. Low priority.

### 17. `chalk` and `agora-access-token` in Production Dependencies
- **File:** `package.json` lines 20 (`chalk` ^4.1.2), line 17 (`agora-access-token`)
- **Evidence:** `chalk` is a dev/utility package. `agora-access-token` likely legacy (LiveKit is primary).
- **Impact:** Increased Docker image size, potential unused code.
- **Fix:** Audit usage. Move `chalk` to devDependencies. Remove `agora-access-token` if unused.

### 18. `.env.example` Placeholder Secrets
- **File:** `.env.example` lines 10-11
- **Evidence:** `JWT_SECRET=your_jwt_secret_here`, `REFRESH_TOKEN_SECRET=your_refresh_token_secret_here` are literal placeholders.
- **Impact:** If committed and used directly, secrets are known. (Note: these are in `.env.example`, not `.env`, so acceptable — but the server.js validation doesn't catch weak secrets.)
- **Fix:** Add a startup warning if `JWT_SECRET` matches known placeholder patterns.

### 19. No `NODE_ENV` Enforcement in Docker
- **File:** `Dockerfile` line 59 (`CMD ["node", "server.js"]`); `docker-compose.yml` line 54 (`NODE_ENV: production`)
- **Evidence:** Dockerfile does not set `NODE_ENV=production`. Relies on docker-compose to pass it.
- **Impact:** If someone runs the Docker image directly (not via compose), `NODE_ENV` is `undefined` — Express runs in development mode (verbose errors, no view caching).
- **Fix:** Add `ENV NODE_ENV=production` to Dockerfile.

### 20. PM2 Default Environment Uses Development
- **File:** `ecosystem.config.js` lines 11-16
- **Evidence:** `env: { NODE_ENV: 'development' }` is the default. `env_production` sets `production`.
- **Impact:** Running `pm2 start ecosystem.config.js` without `--env production` starts in development mode.
- **Fix:** Either document the need for `--env production`, or set the default to production with an explicit `--env development` for local work.

---

# SCORE BREAKDOWN

| Category | Score | Notes |
|---|---|---|
| Security | 62/100 | Missing compression, weak JWT validation, permissive CORS no-origin, no SSL enforcement, no rate-limit store |
| Architecture | 78/100 | Well-structured monolith, redundant Redis libs, dual rate limiting concerns |
| Production Readiness | 75/100 | Excellent Docker/Compose setup, critical package-lock.json missing |
| Dependencies | 70/100 | bcryptjs, chalk in prod, dual Redis, potentially unused agora SDK |
| Logging | 68/100 | Excellent Winston config, but console.log pollution in server.js |
| Performance | 65/100 | No compression, MemoryStore rate limiting, aggressive cron |
| **Overall** | **72/100** | **Solid foundation with critical deployment blockers** |

---

## RECOMMENDATION PRIORITY

| Priority | Issue Count | Action |
|---|---|---|
| 🔴 Immediate (Critical) | 4 | Fix package-lock.json, add compression, fix Dockerfile target, add Redis rate-limit store |
| 🟠 High | 5 | Fix CORS no-origin, consolidate Redis libs, fix 3s cron, fix cron timing, replace bcryptjs |
| 🟡 Medium | 5 | Fix logging inconsistency, fix request logger position, add TWILIO env vars, add JWT entropy check, add Socket.IO connection limits |
| 🟢 Low | 6 | Fix duplicate limiter, document CSP scope, cleanup deps, fix env placeholders, enforce NODE_ENV in Docker, fix PM2 default env |
