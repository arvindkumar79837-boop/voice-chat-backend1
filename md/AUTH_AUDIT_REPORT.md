# 🔐 AUTHENTICATION SYSTEM FORENSIC AUDIT — ARVIND PARTY BACKEND

**Date:** 2026-07-31
**Scope:** JWT utilities, auth controllers, OTP service, Firebase integration, admin auth, refresh token middleware
**Files Audited:** `src/utils/jwt.js`, `src/controllers/auth.controller.js`, `src/controllers/authSecure.controller.js`, `src/controllers/adminAuthController.js`, `src/services/otp.service.js`, `src/config/firebase.js`, `src/middlewares/refreshToken.middleware.js`, `src/config/firebase-admin.js`, `src/models/RefreshToken.js`, `src/models/User.js`, `src/models/Staff.js`, `src/models/TwoFactorAuth.js`, `src/models/DeviceSession.js`

---

## COMPLETE AUTHENTICATION FLOW

```
USER REGISTRATION (Phone Login Flow):
1. Client → POST /api/auth/send-otp { phone }
   → auth.controller.js:29 (sendOtp)
   → otp.service.js:96 (sendOTP)
   → Redis OTP store OR in-memory fallback
   → (Dev: OTP included in response; Prod: sent via provider)

2. Client → POST /api/auth/verify-otp { phone, otp }
   → auth.controller.js:43 (verifyOtp)
   → otp.service.js:56 (verifyOTP)
   → If new user: User.create({ phone, uid, username, ... }) (line 73)
   → JWT.sign() directly (NOT generateAccessToken) (lines 89-99)
   → Returns { token, refreshToken, user }

3. Client → POST /api/auth/refresh
   → authSecure.routes.js → refreshToken.middleware.js:20
   → Verify refresh token JWT (line 34)
   → Look up stored token in DB (line 53)
   → If not found: REVOKE ALL user tokens (line 57) ✅
   → Issue new access + refresh tokens (lines 237-252)

4. Client → POST /api/auth/logout
   → auth.controller.js:271 (logout)
   → blacklistAccessToken(token) — blacklists ONLY access token in Redis (line 277)
   → ❌ Refresh token NOT revoked from DB
```

```
ADMIN AUTH FLOW:
1. Client → POST /api/staff/login { idToken (Firebase) }
   → adminAuthController.js:20
   → verifyIdToken(idToken) — Firebase server-side verification (line 28)
   → Staff.findOne({ uid: staffUid }) (line 35)
   → If high-privilege role: 2FA required (line 51-70)
   → generateStaffTokens(staff) — direct jwt.sign (line 198-216)
   → Returns { accessToken, refreshToken, role, staff }

2. Client → POST /api/staff/verify-2fa { uid, otp }
   → adminAuthController.js:107
   → verifyOTP(staff.phone, otp) (line 123)
   → ⚠️ Comment: "This should be replaced with a real OTP service"
   → generateStaffTokens(staff) (line 130)

3. Client → POST /api/staff/refresh { refreshToken }
   → adminAuthController.js:157
   → jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) (line 166)
   → Check decoded.isStaff === true (line 171)
   → Staff.findOne({ uid: decoded.uid }) (line 175)
   → generateStaffTokens(staff) — issues NEW tokens
   → ❌ Does NOT revoke/rotate the old refresh token
```

```
SOCIAL LOGIN (Google/Apple/Facebook/etc.):
1. Client → POST /api/auth/secure/social { provider, idToken, deviceInfo }
   → authSecure.controller.js:333 (socialLogin)
   → admin.auth().verifyIdToken(idToken) — Firebase verification (line 349)
   → Provider mismatch check (lines 362-366) ✅
   → User lookup by socialProviders.provider + providerUid (line 369)
   → If new: creates user with explicit field whitelist (line 380-401) ✅
   → JWT.sign() directly (lines 413-414) — NOT using generateAccessToken utility

2. Guest Login:
   → authSecure.controller.js:490
   → Creates user with random UID, 7-day guest expiry
   → JWT.sign() directly
```

---

## SCORE: 58 / 100

| Category | Score | Notes |
|---|---|---|
| JWT Configuration | 75/100 | 15m access, 30d refresh, jti included, Redis blacklist. But auth.controller.js bypasses utility |
| Token Rotation | 45/100 | Dual implementation (auth.controller.js vs refreshToken.middleware.js) with inconsistent security |
| Token Revocation | 35/100 | Access token blacklist works, but logout DOES NOT revoke refresh tokens |
| OTP Security | 60/100 | 6-digit numeric OTP, Redis storage with expiry. Dev env leaks OTP in response |
| 2FA Security | 50/100 | TOTP via speakeasy ✅, but hardcoded "123456" bypass, secrets not select:false |
| Password Security | 70/100 | bcryptjs (slow) but 12 rounds ✅. Email reset token returned in API response |
| Firebase Integration | 80/100 | Server-side verifyIdToken ✅, provider mismatch check ✅ |
| Admin Auth | 55/100 | Firebase-based, but 2FA verification is stubbed, no refresh token rotation |
| Session Management | 45/100 | DeviceSession TTL ✅, but logoutDevice has broken logic |
| Replay Protection | 40/100 | Backward-compat bypass disables replay protection |
| **Overall** | **58/100** | **Multiple critical vulnerabilities in token lifecycle and 2FA** |

---

## 🔴 CRITICAL ISSUES

### 1. Hardcoded 2FA Bypass Code
- **File:** `src/controllers/authSecure.controller.js`
- **Line:** 76
- **Code:** `isValid = code === '123456';`
- **Evidence:** In `verifyAndEnable2FA()` (lines 65-109), when `twoFactor.method !== 'totp'`, the code checks `code === '123456'`. This is a **universal backdoor** — any user with SMS/OTP/email 2FA can bypass verification by entering "123456".
- **Impact:** Complete 2FA bypass for all non-TOTP users. An attacker with access to a user's device/browser can authenticate without the second factor.
- **Fix:** Remove the hardcoded `code === '123456'` fallback. Implement proper SMS/email OTP verification using the same `verifyOTP()` function from `otp.service.js`.

### 2. Password Reset Token Returned in API Response
- **File:** `src/controllers/authSecure.controller.js`
- **Line:** 253
- **Code:** `res.status(200).json({ ..., data: { resetToken } });`
- **Evidence:** `forgotPassword()` (lines 241-255) generates a JWT reset token signed with `process.env.JWT_SECRET` (1-hour expiry) and **returns it directly in the HTTP response**. The comment says "sendEmail" was planned but never implemented — the token is returned to the caller.
- **Impact:** Any authenticated user can request a password reset token for ANY email/phone and receive the token in the response. This is equivalent to returning the password directly. An attacker can reset any user's password without email access.
- **Fix:** Remove `resetToken` from the response. Send it via email/SMS using a proper email service. Return generic message: "If an account exists, a reset link has been sent."

### 3. Logout Does NOT Revoke Refresh Tokens
- **File:** `src/controllers/auth.controller.js`
- **Lines:** 271-287
- **Code:** `logout()` only calls `blacklistAccessToken(token)` (line 277) — blacklists the access token in Redis. The refresh token remains valid in the database.
- **Evidence:** The `RefreshToken` model (`src/models/RefreshToken.js`) has no revocation on logout. The `refreshToken()` endpoint (line 228) deletes the old refresh token on use, but `logout()` does not.
- **Impact:** After logout, the user's refresh token can still be used to obtain new access tokens indefinitely (up to 30 days). This defeats the purpose of logout — a compromised or shared device can retain persistent access.
- **Fix:** In `logout()`, also delete or revoke the refresh token:
  ```js
  const { refreshToken } = req.body;
  if (refreshToken) {
    await RefreshToken.findOneAndDelete({ token: refreshToken });
  }
  ```

### 4. Account Deletion Does NOT Revoke Active Tokens
- **File:** `src/controllers/authSecure.controller.js`
- **Lines:** 293-371
- **Code:** `deleteAccount()` marks `isDeleted: true`, `isActive: false`, `isBanned: true` but does NOT revoke refresh tokens or blacklist active access tokens.
- **Evidence:** `User.js` model (line 321: `user.isDeleted = true`) is set, but `RefreshToken` collection still contains valid tokens for this user.
- **Impact:** A deleted user's refresh tokens remain valid for up to 30 days. The user can still authenticate after account deletion.
- **Fix:** In `deleteAccount()`, revoke all refresh tokens:
  ```js
  await RefreshToken.updateMany({ userId: user._id }, { isRevoked: true, revokedAt: new Date(), revokedReason: 'Account deletion' });
  ```

### 5. Refresh Token Rotation Backward-Compatibility Bypass
- **File:** `src/controllers/auth.controller.js`
- **Lines:** 228-233
- **Code:**
  ```js
  const oldTokenDoc = await RefreshToken.findOneAndDelete({ token: refreshToken, userId });
  if (!oldTokenDoc) {
    // Could be a token issued before rotation was introduced — allow once
    // but do NOT log the user out (backward compat)
  }
  ```
- **Evidence:** If a refresh token is not found in the database (e.g., stolen token that was never persisted), the code **still issues new tokens** instead of revoking. The comment says "allow once for backward compat" but this is a **critical security bypass** — it allows replay attacks with stolen tokens.
- **Contrast:** `refreshToken.middleware.js:55-57` correctly handles this case by **revoking ALL tokens** when an unknown token is presented. The two implementations are inconsistent.
- **Impact:** A stolen refresh token that was never stored in the DB can be used to obtain new valid tokens indefinitely.
- **Fix:** Remove the backward-compatibility bypass. If `oldTokenDoc` is null, treat it as token theft — revoke all tokens and return 401, matching the behavior in `refreshToken.middleware.js`.

---

## 🟠 HIGH ISSUES

### 6. Inconsistent JWT Token Generation (Bypasses Utility Functions)
- **File:** `src/controllers/auth.controller.js`
- **Lines:** 89-99, 237-248, 413-414, 510-511
- **Evidence:** `auth.controller.js` uses `jwt.sign()` **directly** instead of the utility functions in `src/utils/jwt.js`:
  - `verifyOtp()` (line 89): `jwt.sign({ id, role, uid, phone }, JWT_SECRET, '15m')` — includes `phone` in access token payload, **no `jti`**
  - `refreshToken()` (line 237): `jwt.sign({ id, role, uid }, JWT_SECRET, '15m')` — **no `jti`** in access token
  - `socialLogin()` (line 413): `jwt.sign({ userId, uid, role }, JWT_SECRET, '15m')` — also uses `userId` instead of `id` (inconsistent payload key!)
  - `guestLogin()` (line 510): same direct `jwt.sign()`

  In contrast, `src/utils/jwt.js:28-34` (`generateAccessToken`) correctly includes `jti: crypto.randomUUID()`.

  **Impact:**
  - Access tokens generated by auth.controller.js **cannot be individually blacklisted** (no `jti` for Redis blacklist lookup)
  - Inconsistent payload structure (`userId` vs `id` vs `userId`) causes confusion in middleware that reads `req.user.id` vs `req.user.userId`
  - The `phone` field is included in some tokens but not others — PII in JWT payload

- **Fix:** Use `generateAccessToken()` and `generateRefreshToken()` from `src/utils/jwt.js` everywhere. Remove all direct `jwt.sign()` calls.

### 7. No Refresh Token Rotation in Admin Auth
- **File:** `src/controllers/adminAuthController.js`
- **Lines:** 157-193
- **Code:** `refreshToken()` (line 157) verifies the JWT, finds the staff, and issues **new tokens** via `generateStaffTokens()` — but **never deletes or rotates the old refresh token**. The old token remains valid indefinitely.
- **Evidence:** No `RefreshToken` model interaction. `generateStaffTokens()` (line 198) creates tokens without `jti`.
- **Impact:** Stolen admin refresh tokens are valid forever (within the 30-day JWT expiry). No replay protection.
- **Fix:** Store refresh tokens in the `RefreshToken` collection and delete on use. Add `jti` to the payload.

### 8. Admin 2FA Verification is Stubbed
- **File:** `src/controllers/adminAuthController.js`
- **Line:** 123
- **Code:** `const isOtpValid = await verifyOTP(staff.phone, otp);`
- **Evidence:** The comment at line 120-122 says: "Here you'd verify the OTP. For Firebase phone OTP, you'd use the admin SDK. For Google Authenticator, you'd use a library like 'speakeasy'. **Let's simulate a simple check for now. This should be replaced with a real OTP service.**"
- **Impact:** Admin 2FA uses the same generic `verifyOTP()` (phone-based OTP) instead of TOTP for high-privilege roles. This is inconsistent with the user-facing 2FA implementation in `authSecure.controller.js` which uses `speakeasy` for TOTP.
- **Fix:** Implement proper TOTP verification for admin 2FA using `speakeasy.totp.verify()`, matching the user-facing 2FA implementation.

### 9. Refresh Token Not Revoked on Device Logout
- **File:** `src/controllers/authSecure.controller.js`
- **Line:** 209
- **Code:** `await RefreshToken.findOneAndUpdate({ token: session.sessionToken }, { isRevoked: true, ... });`
- **Evidence:** `logoutDevice()` searches for a refresh token by `sessionToken` (line 209), but the `RefreshToken` model (`src/models/RefreshToken.js`) stores tokens by the JWT token string, not by `sessionToken`. The `DeviceSession` model stores `sessionToken` as a separate field. This lookup `findOneAndUpdate({ token: session.sessionToken })` will **always return null** because `session.sessionToken` is a hex string from `crypto.randomBytes(64)`, not the actual JWT refresh token.
- **Impact:** Revoking a specific device does NOT actually revoke its refresh token. The user can continue using the session.
- **Fix:** Store the actual JWT refresh token in the `DeviceSession` model (not just `sessionToken`), or link `DeviceSession.sessionToken` to `RefreshToken.token` via a proper foreign key.

### 10. OTP Comparison is Not Timing-Safe
- **File:** `src/services/otp.service.js`
- **Line:** 77
- **Code:** `if (storedOtp !== otp)`
- **Evidence:** OTP verification uses strict equality (`!==`), which is vulnerable to **timing attacks**. An attacker can measure response times to guess the correct OTP digit-by-digit.
- **Impact:** In theory, an attacker could brute-force OTPs more efficiently by measuring response times. In practice, the 5-minute OTP window + rate limiting mitigates this, but it's a best-practice violation.
- **Fix:** Use `crypto.timingSafeEqual(Buffer.from(storedOtp), Buffer.from(otp))` for constant-time comparison.

---

## 🟡 MEDIUM ISSUES

### 11. In-Memory OTP Fallback Is Not Cluster-Safe
- **File:** `src/services/otp.service.js`
- **Line:** 23
- **Code:** `const otpMemoryStore = new Map();`
- **Evidence:** When Redis is unavailable, OTPs are stored in an in-memory `Map()`. In PM2 cluster mode (`ecosystem.config.js:7: instances: 'max'`), each worker has its own memory — an OTP stored in worker A cannot be verified in worker B.
- **Impact:** If Redis fails and the app runs in cluster mode, OTP verification will randomly fail ~50% of the time depending on which worker handles the request.
- **Fix:** Log a critical error when falling back to in-memory mode in production. Or ensure Redis is always available in production.

### 12. Admin Auth Response Leaks Permissions
- **File:** `src/controllers/adminAuthController.js`
- **Line:** 88
- **Code:** `permissions: staff.permissions`
- **Evidence:** The login response includes `staff.permissions` (the full granular permissions object). The `Staff.js` model (line 86-98) defines `granularPermissions` as a Map with `canView`, `canCreate`, `canEdit`, `canDelete`, `canBan`, `canApprove`, `canAssign`.
- **Impact:** An attacker who intercepts the login response gains a blueprint of the entire permission system, enabling targeted privilege escalation attempts.
- **Fix:** Remove `permissions` from the login response. Only return `role` and a minimal `permissions` array (action strings) if the client needs them.

### 13. User Auth Response Includes PII in JWT Payload
- **File:** `src/controllers/auth.controller.js`
- **Line:** 90
- **Code:** `jwt.sign({ id, role, uid, phone }, ...)`
- **Evidence:** The access token payload includes `phone` (line 90) and `role` (line 96). The `phone` is PII that should not be in a JWT — it can be decoded by anyone if the token is intercepted.
- **Impact:** JWT tokens are base64-encoded (not encrypted). Including PII in the payload exposes it to anyone who intercepts the token.
- **Fix:** Move `phone` out of the JWT payload. Use only `{ id, role, uid, jti }`. Fetch phone from the database when needed.

### 14. Inconsistent Token Payload Keys
- **File:** `src/controllers/auth.controller.js` vs `src/controllers/adminAuthController.js`
- **Evidence:**
  - `auth.controller.js` uses `id` as the user ID key (lines 89, 237, 413)
  - `authSecure.controller.js` uses `userId` as the key (lines 413, 510)
  - `auth.controller.js:refreshToken()` (line 245): `jwt.sign({ id: user._id.toString() }, ...)` — no role, no uid in refresh token
  - `authSecure.controller.js:refreshToken()` (line 414): `jwt.sign({ userId: user._id.toString() }, ...)` — different key name

  The `authMiddleware` (`src/middlewares/auth.middleware.js:28`) reads `req.user.id` — this will be `undefined` for tokens issued by `socialLogin` (which uses `userId`).

### 15. Deprecated Token Generator Still in Use
- **File:** `src/utils/jwt.js`
- **Line:** 103-106
- **Code:**
  ```js
  const generateToken = (userId) => {
    Logger.warn('[jwt] DEPRECATED: generateToken() called');
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
  };
  ```
- **Evidence:** The deprecated `generateToken()` creates a **30-day access token** with NO `jti` and NO role. If any controller still uses this, access tokens are valid for 30 days and cannot be individually blacklisted.
- **Impact:** 30-day access tokens = indefinite session. No JTI = no blacklist capability.
- **Fix:** Remove `generateToken()` from exports. Find and replace all usages with `generateAccessToken()`.

### 16. No `oldPassword` Validation for Social Account Password Reset
- **File:** `src/controllers/authSecure.controller.js`
- **Line:** 268
- **Code:** `if (user.provider !== 'email') return res.status(400).json(...);`
- **Evidence:** `resetPassword()` correctly blocks social login accounts (line 268), but the same check is NOT in `changePassword()`. If a social login user calls `changePassword()`, the `bcrypt.compare(currentPassword, user.password)` at line 288 would compare against `undefined` (no password stored) and fail silently.
- **Fix:** Add `provider !== 'email'` check to `changePassword()` as well.

---

## 🟢 LOW ISSUES

### 17. Error Code Typo in refreshToken Middleware
- **File:** `src/middlewares/refreshToken.middleware.js`
- **Line:** 60
- **Code:** `code: 'REFRESH_TOKEN_INALID'` (should be `INVALID`)
- **Evidence:** Typo in error response code. Clients checking for `REFRESH_TOKEN_INVALID` will miss this.
- **Fix:** Fix typo to `REFRESH_TOKEN_INVALID`.

### 18. OTP Sent in Development Response
- **File:** `src/services/otp.service.js`
- **Line:** 112
- **Code:** `...(process.env.NODE_ENV === 'development' && { otp })`
- **Evidence:** In development mode, the OTP is included in the `sendOTP` response. This is intentional for testing but documented as a risk.
- **Assessment:** Acceptable for development, but should be logged prominently. ✅ (low)

### 19. No Password Complexity Validation
- **File:** `src/controllers/authSecure.controller.js`
- **Lines:** 270-271
- **Code:** `user.password = await bcrypt.hash(newPassword, 12);`
- **Evidence:** `resetPassword()` and `changePassword()` accept any password without minimum length, complexity, or common-password checks.
- **Fix:** Add password validation (minimum 8 chars, mixed case, numbers, special chars).

### 20. Staff Login Does Not Create LoginHistory Entry
- **File:** `src/controllers/adminAuthController.js`
- **Lines:** 20-102
- **Evidence:** `login()` verifies Firebase token and issues JWT, but does NOT create a `LoginHistory` entry (unlike `authSecure.controller.js` which creates `DeviceSession` and `LoginHistory`). No audit trail for admin logins.
- **Fix:** Create `LoginHistory` entry in admin login.

---

# COMPLETE AUTHENTICATION FLOW DIAGRAM

```
USER REGISTRATION & LOGIN:
┌─────────────────────────────────────────────────────────────┐
│                      PHONE LOGIN FLOW                       │
├─────────────────────────────────────────────────────────────┤
│ 1. POST /auth/send-otp {phone}                              │
│    auth.controller.js:29 → otp.service.js:96                │
│    → generateOTP() (6-digit, Math.random) ✅                 │
│    → storeOTP() → Redis setEx(5min) or Memory fallback      │
│    → (Dev only) OTP in response ⚠️                          │
│                                                             │
│ 2. POST /auth/verify-otp {phone, otp}                       │
│    auth.controller.js:43 → otp.service.js:56                │
│    → storedOtp !== otp (NOT timing-safe) ⚠️                 │
│    → User.findOne({phone}) or User.create()                 │
│    → jwt.sign() DIRECT (no jti, no utility) ⚠️              │
│    → Returns {token, refreshToken, user}                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      TOKEN REFRESH FLOW                      │
├─────────────────────────────────────────────────────────────┤
│ 1. POST /auth/refresh {refreshToken}                        │
│    → refreshToken.middleware.js:20                          │
│    → verifyRefreshToken() ✅                                │
│    → RefreshToken.findOne({userId, token}) ✅               │
│    → If not found: REVOKE ALL tokens ✅                     │
│    → If revoked: 401 ✅                                     │
│    → If expired: 401 ✅                                     │
│    → Issue new tokens, delete old ✅                        │
│                                                             │
│ 2. POST /auth/refresh (auth.controller.js:193 — LEGACY)     │
│    → NO DB token lookup ❌                                   │
│    → If not found: ALLOW (backward compat) ❌ CRITICAL      │
│    → No token rotation/deletion ❌                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      LOGOUT FLOW                           │
├─────────────────────────────────────────────────────────────┤
│ 1. POST /auth/logout                                        │
│    auth.controller.js:271                                   │
│    → blacklistAccessToken(token) → Redis ✅                 │
│    → ⚠️ Refresh token NOT revoked ❌ CRITICAL               │
│                                                             │
│ 2. POST /auth-secure/logout-device {sessionId}             │
│    authSecure.controller.js:198                             │
│    → DeviceSession: isActive=false ✅                       │
│    → RefreshToken: findOneAndUpdate({token: sessionToken}) ❌│
│    → Token lookup by wrong field — never matches ❌         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      ADMIN AUTH FLOW                       │
├─────────────────────────────────────────────────────────────┤
│ 1. POST /staff/login {idToken (Firebase)}                  │
│    adminAuthController.js:20                               │
│    → verifyIdToken(idToken) — Firebase server ✅            │
│    → Staff.findOne({uid}) ✅                                │
│    → High-privilege: 2FA required (line 51-70)              │
│    → generateStaffTokens() — direct jwt.sign, no jti ❌     │
│    → Returns {accessToken, refreshToken, role, staff}       │
│    → ⚠️ permissions leaked in response (line 88)           │
│                                                             │
│ 2. POST /staff/verify-2fa {uid, otp}                        │
│    adminAuthController.js:107                               │
│    → verifyOTP(staff.phone, otp) — phone OTP, not TOTP ⚠️   │
│    → Comment: "should be replaced with real OTP service"   │
│                                                             │
│ 3. POST /staff/refresh {refreshToken}                      │
│    adminAuthController.js:157                               │
│    → jwt.verify ✅                                          │
│    → Check decoded.isStaff ✅                               │
│    → ⚠️ No refresh token rotation/deletion ❌ HIGH          │
│    → ⚠️ No DB token lookup ❌                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  SOCIAL LOGIN FLOW                          │
├─────────────────────────────────────────────────────────────┤
│ 1. POST /auth-secure/social {provider, idToken, deviceInfo} │
│    authSecure.controller.js:333                              │
│    → admin.auth().verifyIdToken(idToken) ✅                 │
│    → Provider mismatch check ✅                             │
│    → User lookup by socialProviders ✅                      │
│    → New user: explicit field whitelist ✅                  │
│    → jwt.sign() direct (no jti, uses userId not id) ⚠️      │
│                                                             │
│ 2. POST /auth-secure/link-{provider}                       │
│    → Firebase verification ✅                               │
│    → Pushes to socialProviders array ✅                     │
│                                                             │
│ 3. POST /auth-secure/unlink-{provider}                     │
│    → Prevents unlinking primary provider ✅                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    PASSWORD RESET FLOW                      │
├─────────────────────────────────────────────────────────────┤
│ 1. POST /auth-secure/forgot-password {email or phone}       │
│    authSecure.controller.js:241                              │
│    → Generic response ✅ (doesn't reveal if account exists) │
│    → ⚠️ Returns resetToken in response ❌ CRITICAL          │
│    → Token signed with JWT_SECRET (not reset-specific) ⚠️  │
│                                                             │
│ 2. POST /auth-secure/reset-password {token, newPassword}    │
│    → jwt.verify(token, JWT_SECRET) ✅                       │
│    → Check type === 'password_reset' ✅                     │
│    → Find user by token + expiry ✅                         │
│    → bcryptjs.hash(newPassword, 12) ✅                      │
│    → No password complexity check ⚠️                        │
│    → Provider check (no email providers) ✅                  │
└─────────────────────────────────────────────────────────────┘
```

---

## FIX PRIORITY

| Priority | Count | Action |
|---|---|---|
| 🔴 Immediate | 5 | Fix 2FA bypass "123456" backdoor; Remove password reset token from API response; Revoke refresh token on logout; Remove backward-compat rotation bypass; Fix DeviceSession/RefreshToken lookup field |
| 🟠 High | 4 | Use generateAccessToken() everywhere; Add refresh token rotation to admin auth; Implement TOTP for admin 2FA; Fix timing-safe OTP comparison |
| 🟡 Medium | 6 | Fix token payload key inconsistency; Remove deprecated generateToken; Remove PII from JWT payload; Remove permissions from login response; Add password complexity validation; Log admin logins |
| 🟢 Low | 1 | Fix REFRESH_TOKEN_INALID typo; Document dev OTP leak; Ensure in-memory OTP fallback alerts in prod |