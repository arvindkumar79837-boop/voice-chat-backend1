# OWASP Top 10 Compliance Report — Arvind Party Backend

**Date**: 2025-07-31  
**Scope**: Broken Access Control, Cryptographic Failure, Injection, Insecure Design, Security Misconfiguration, Vulnerable Components, Authentication Failure, Integrity Failure, Logging, SSRF  
**Total Files Audited**: 80+ controllers, services, models, routes, middlewares, configs

---

## Executive Summary

The codebase demonstrates **strong authentication and authorization patterns** (JWT with refresh rotation, role-based middleware, 2FA, device sessions). **No SQL injection or command injection vectors** were found — MongoDB ODM is used exclusively with parameterized queries. **No eval() or dynamic code execution** found. However, there are **critical gaps in SSRF protection** (unvalidated axios calls to external APIs), **missing input sanitization** in chat/event flows, **no dependency vulnerability scanning**, and **inconsistent rate limiting** across admin surfaces.

| Category | Status |
|---|---|
| Broken Access Control | 🟡 Mostly strong; some missing ownership checks on socket handlers |
| Cryptographic Failure | 🟢 JWT + bcrypt/ Firebase + TTL sessions; no plaintext secrets |
| Injection | 🟢 No SQL/command injection; MongoDB ODM safe |
| Insecure Design | 🟡 Client-trusted inputs (game outcomes, event progress); no server-side verification |
| Security Misconfiguration | 🟡 Helmet + CORS + rate limiters; missing `app.set('trust proxy')` already present, no HSTS, no CSP |
| Vulnerable Components | 🔴 No `npm audit` or Snyk/Dependabot evidence |
| Authentication Failure | 🟢 JWT + refresh + 2FA + device session; legacy token deprecation warning |
| Integrity Failure | 🟡 Google Play verification present; no webhook signature on all inbound hooks |
| Logging | 🟢 Logger + audit logs + request ID tracing |
| SSRF | 🔴 Unvalidated external axios calls (YouTube, Google Play, Slack, IP service) |

---

## 1. Broken Access Control

| Severity | Location | Issue |
|---|---|---|
| 🟡 MEDIUM | `roomSocket.js` | Many handlers check `room.ownerId.toString() === userId` but some paths use `authedUserId` from socket data which could be spoofed if socket auth is bypassed. |
| 🟡 MEDIUM | `familyRoutes.js:39-50` | `/upgrade` inline route has no role check — any family member can upgrade family level. |
| 🟢 OK | `adminMiddleware.js` | `verifyStaff`, `verifyOwner`, `requirePermission` enforce role hierarchy. |
| 🟢 OK | `powerValidation.middleware.js` | `checkRoomOwner`, `checkPowerMiddleware` enforce room-level authZ. |
| 🟢 OK | Routes | `authMiddleware` applied to all protected routes. |

**Recommendation**:
- Add server-side family role check: only `Patriarch` or `co_leader` can call `/upgrade`.
- Ensure all socket handlers re-validate ownership from DB, not just `socket.data.userId`.

---

## 2. Cryptographic Failure

| Severity | Location | Issue |
|---|---|---|
| 🟢 OK | `src/utils/jwt.js` | Access token 15m, refresh token 30d, both signed with `JWT_SECRET` / `REFRESH_TOKEN_SECRET`. `jti` random UUID prevents replay. |
| 🟢 OK | `auth.middleware.js` | Token blacklist check (`isTokenBlacklisted`) before acceptance. |
| 🟢 OK | `deploymentService.js` | Webhook signature verification using `crypto.createHmac('sha256')` + `timingSafeEqual`. |
| 🟢 OK | `otp.service.js` | OTP stored in Redis with TTL; no plaintext persistence beyond short window. |
| 🟢 OK | `TwoFactorSession` | TTL index auto-expires 2FA sessions. |
| 🟡 MEDIUM | `jwt.js` | Legacy `generateToken()` still exported — 30-day expiry, no role, no `jti`. If any old controller uses it, it weakens security. |

**Recommendation**:
- Remove `generateToken()` or add deprecation warning + force migration.
- Add `algorithms: ['HS256']` to all `jwt.sign()` and `jwt.verify()` calls to prevent algorithm confusion.

---

## 3. Injection

| Severity | Location | Issue |
|---|---|---|
| 🟢 OK | MongoDB queries | All queries use Mongoose ODM with parameterized inputs. No raw `$where` or string concatenation found. |
| 🟢 OK | `gift.routes.js` | Regex sanitized: `sanitized = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`. |
| 🟢 OK | `familyRoutes.js` | Search uses `new RegExp(search, 'i')` — safe if `search` is user input? Actually RegExp constructor with user input can cause ReDoS. |
| 🟡 MEDIUM | `familyRoutes.js:126` | `new RegExp(search, 'i')` — if `search` contains crafted regex, it can cause ReDoS. Should use escaped regex or `$regex` with string. |
| 🟢 OK | `chatController.js` | `$or` array for message queries — safe. |

**Recommendation**:
- Replace `new RegExp(search, 'i')` with `{ $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }`.
- Add query timeout to all aggregation pipelines (`maxTimeMS: 30000`).

---

## 4. Insecure Design

| Severity | Location | Issue |
|---|---|---|
| 🟡 MEDIUM | `gameController.js`, `webViewGameController.js` | Game outcomes (`winAmount`) are client-submitted without server-side verification. A compromised client can submit any win amount. |
| 🟡 MEDIUM | `eventSocket.js:63-103` | `update_event_progress` accepts `progress_value` from client and increments `progress.progress` without validating task completion criteria. |
| 🟡 MEDIUM | `giftQueueWorker.js` | Worker trusts `job.data` entirely — no HMAC or sender authentication. A malicious producer could enqueue a job with victim's `senderId`. |
| 🟢 OK | `diamondEconomyController.js` | Google Play purchase verified server-side before crediting. |
| 🟢 OK | `dealerController.js` | Session transactions with balance pre-checks. |

**Recommendation**:
- Add server-side game outcome verification: deterministic seed or signed result from game server.
- Validate event progress against task rules on server, not just client delta.
- Sign BullMQ job data with HMAC and verify in worker.

---

## 5. Security Misconfiguration

| Severity | Location | Issue |
|---|---|---|
| 🟡 MEDIUM | `app.js` | `app.set('trust proxy', 1)` present — good. But no `helmet.hsts()`, no `Content-Security-Policy`, no `X-Content-Type-Options` beyond helmet defaults. |
| 🟡 MEDIUM | `server.js` | CORS allows specific origins — good. But no `credentials: true` guard on all routes? Actually it is set globally. |
| 🟢 OK | `app.js` | `helmet()` enabled. Rate limiters on `/api/` and auth. |
| 🟢 OK | `app.js` | `express.json({ limit: '10mb' })` — reasonable. |
| 🔴 HIGH | `package.json` | No evidence of `npm audit`, Snyk, or Dependabot. Vulnerable dependencies could be present. |

**Recommendation**:
- Add `helmet.hsts({ maxAge: 31536000, includeSubDomains: true })`.
- Add `app.use(cors({ origin: allowedOrigins, credentials: true }))` with env-driven list.
- Enable GitHub Dependabot or Snyk for dependency scanning.

---

## 6. Vulnerable Components

| Severity | Location | Issue |
|---|---|---|
| 🔴 HIGH | `package.json` | No lockfile integrity check, no audit pipeline. |
| 🟡 MEDIUM | `server.js` | BullMQ Redis version patch (`minimumVersion = '3.0.0'`) — suggests running older Redis. Should upgrade Redis to 5+. |
| 🟢 OK | `queueService.js` | BullMQ retry/backoff configured. |
| 🟢 OK | `deploymentService.js` | Webhook signature verification present. |

**Recommendation**:
- Upgrade Redis to 5+ and remove version patch.
- Add `npm audit --audit-level=high` to CI/CD pipeline.

---

## 7. Authentication Failure

| Severity | Location | Issue |
|---|---|---|
| 🟢 OK | `auth.middleware.js` | JWT + refresh rotation + blacklist. |
| 🟢 OK | `adminMiddleware.js` | Role-based access with permission arrays. |
| 🟢 OK | `authSocket.js` | Socket JWT auth with `DeviceSession` binding. |
| 🟢 OK | `TwoFactorSession` | TTL expiry, server-side enforcement. |
| 🟡 MEDIUM | `jwt.js` | No `algorithms` restriction in `jwt.verify()` — potential algorithm confusion if `JWT_SECRET` is weak. |
| 🟡 MEDIUM | `auth.routes.js` | `/admin/verify` accepts any Firebase ID token without verifying `aud` or `iss` against expected values. |

**Recommendation**:
- Add `algorithms: ['HS256']` to all `jwt.verify()` calls.
- Validate Firebase token `aud`, `iss`, `sub` against expected project ID.

---

## 8. Integrity Failure

| Severity | Location | Issue |
|---|---|---|
| 🟢 OK | `deploymentService.js` | Webhook signature verification with `timingSafeEqual`. |
| 🟢 OK | `diamondEconomyController.js` | Google Play purchase token verified with service account. |
| 🟡 MEDIUM | `giftQueueWorker.js` | No HMAC on job data — any producer can inject arbitrary jobs. |
| 🟡 MEDIUM | `eventSocket.js` | Client self-reports progress — no server-side task completion verification. |
| 🟡 MEDIUM | `webViewGameController.js` | `winAmount` accepted from client without server verification. |

**Recommendation**:
- Add HMAC to BullMQ job payloads.
- Implement server-side game outcome verification.

---

## 9. Logging

| Severity | Location | Issue |
|---|---|---|
| 🟢 OK | `Logger` | Centralized logger used across controllers, sockets, services. |
| 🟢 OK | `app.js` | Request ID tracing (`X-Request-ID`). |
| 🟢 OK | `auditLogService.js` | Comprehensive audit log with resource type, action, userId, IP. |
| 🟢 OK | `security.controller.js` | Suspicious activity logging, login history. |
| 🟡 MEDIUM | `auth.middleware.js` | Failed auth attempts logged? Not explicitly — only error responses. Should log invalid token attempts for brute-force detection. |
| 🟡 MEDIUM | `MonitoringService` | Metrics in memory only — no persistent time-series DB. |

**Recommendation**:
- Add audit log on failed auth attempts (`INVALID_TOKEN`, `TOKEN_EXPIRED`).
- Ship metrics to Prometheus/InfluxDB for long-term trend analysis.

---

## 10. SSRF (Server-Side Request Forgery)

| Severity | Location | Issue |
|---|---|---|
| 🔴 HIGH | `youtube.controller.js` | `axios.get('https://www.googleapis.com/youtube/v3/search')` with user-supplied `q` parameter. No URL whitelist validation. |
| 🔴 HIGH | `ip.service.js` | `axios.get(apiUrl)` where `apiUrl` is constructed from user IP lookup service. No allowlist. |
| 🟡 MEDIUM | `fraudDetection.service.js` | `axios.get` to Google Play API — URL is hardcoded, low risk. |
| 🟡 MEDIUM | `healthAlertService.js` | `axios.post(process.env.ALERT_SLACK_WEBHOOK)` — webhook URL from env; if env is compromised, SSRF possible. |
| 🟡 MEDIUM | `deploymentService.js` | `axios.get(healthUrl)` where `healthUrl` is from env. Acceptable if env is trusted. |
| 🟡 MEDIUM | `backupService.js` | `axios.post(`${this.primaryServer}/api/admin/backup/create`)` — `primaryServer` from env. |

**Recommendation**:
- For YouTube search, validate `q` length and use server-side API key with quota limits.
- For IP service, use a fixed allowlist of IP lookup providers.
- For Slack webhook, validate URL format and add timeout/response size limit.

---

## Security Concerns Summary

| # | Severity | File | Issue |
|---|---|---|---|
| 1 | 🔴 HIGH | `package.json` | No dependency vulnerability scanning (npm audit/Snyk) |
| 2 | 🔴 HIGH | `youtube.controller.js` | SSRF via unsanitized YouTube API query |
| 3 | 🔴 HIGH | `ip.service.js` | SSRF via user-triggered IP lookup request |
| 4 | 🟡 MEDIUM | `familyRoutes.js` | ReDoS via `new RegExp(search, 'i')` |
| 5 | 🟡 MEDIUM | `jwt.js` | Legacy `generateToken()` weakens auth |
| 6 | 🟡 MEDIUM | `game/webViewGame` | Client-trusted outcomes without server verification |
| 7 | 🟡 MEDIUM | `eventSocket.js` | Client self-reports progress |
| 8 | 🟡 MEDIUM | `giftQueueWorker.js` | Unsigned job data — forged jobs accepted |
| 9 | 🟢 LOW | `auth.middleware.js` | No log on failed auth attempts |
| 10 | 🟢 LOW | `app.js` | Missing HSTS, CSP headers |

---

## Recommendations Priority

### P0 — SSRF & Injection
1. **Add URL allowlist** for YouTube and IP service calls.
2. **Fix ReDoS** in `familyRoutes.js` search regex.
3. **Add dependency scanning** (npm audit in CI).

### P1 — Authentication & Integrity
4. **Restrict JWT algorithms** — add `algorithms: ['HS256']`.
5. **Validate Firebase token** `aud`/`iss`.
6. **Sign BullMQ jobs** with HMAC.
7. **Add server-side game outcome verification**.

### P2 — Hardening
8. **Add HSTS + CSP** headers via helmet.
9. **Log failed auth attempts**.
10. **Remove legacy `generateToken()`**.

---

## Positive Patterns

- JWT with refresh rotation and blacklist.
- Role-based access control with permission arrays.
- 2FA with TTL sessions.
- Webhook signature verification with `timingSafeEqual`.
- Request ID tracing for distributed debugging.
- MongoDB ODM prevents SQL/command injection.
- No `eval()` or dynamic code execution found.

---

*End of report.*