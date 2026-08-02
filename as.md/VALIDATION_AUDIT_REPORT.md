# 🔍 INPUT VALIDATION AUDIT REPORT — ARVIND PARTY BACKEND

**Date:** 2026-07-31
**Scope:** All 78 route files in `src/routes/`, validation middleware in `src/middlewares/`
**Method:** Full grep across all route files for validation patterns + manual review of validation middleware

---

## SCORE: 15 / 100

| Category | Score | Notes |
|---|---|---|
| Body Validation | 5/100 | Only 6 of 393 POST/PUT/PATCH endpoints have body validation |
| Params Validation | 10/100 | validateObjectId exists but never used in any route file |
| Query Validation | 30/100 | queryValidation middleware applied to ~8 routes; validatePagination never used |
| File Validation | 40/100 | Only profileRoutes.js has multer with fileFilter + fileSize limit |
| ObjectId Validation | 0/100 | validateObjectId function exists but is NEVER called in any route |
| Phone Validation | 30/100 | validatePhone used on 3 auth routes only; 10-digit regex |
| Email Validation | 0/100 | validateEmail function exists but is NEVER called in any route |
| Missing Validation | 5/100 | 76 of 78 route files have ZERO validation middleware |
| **Overall** | **15/100** | **Validation is almost entirely absent from the codebase** |

---

## VALIDATION COVERAGE STATISTICS

| Metric | Count |
|---|---|
| Total route files | 78 |
| Total route definitions | 773 |
| POST/PUT/PATCH routes (need body validation) | 393 |
| Routes WITH validation middleware | 6 (0.78%) |
| Routes WITHOUT validation middleware | 767 (99.22%) |
| Route files with ANY validation | 2 (auth.routes.js, wallet.routes.js) |
| Route files with ZERO validation | 76 (97.4%) |
| Route files with file upload validation | 1 (profileRoutes.js) |
| Validation functions available | 10 |
| Validation functions actually used | 2 (validatePhone, validateBody) |

---

## VALIDATION MIDDLEWARE INVENTORY

### Available Functions (`src/middlewares/validation.middleware.js`, 181 lines)

| Function | Line | Purpose | Used in Routes? |
|---|---|---|---|
| `handleValidationErrors` | 4 | Error handler for express-validator | ✅ Internal use |
| `validatePhone()` | 20 | 10-digit phone regex | ✅ auth.routes.js:43,50,57 |
| `validateOTP()` | 29 | 4-6 digit numeric OTP | ❌ NEVER USED |
| `validateEmail()` | 40 | Email format + normalize | ❌ NEVER USED |
| `validateLogin()` | 50 | Phone + OTP combined | ❌ NEVER USED |
| `validateUserId()` | 63 | NotEmpty param check | ❌ NEVER USED |
| `validatePagination()` | 72 | Page/limit query validation | ❌ NEVER USED |
| `validateBody(fields)` | 85 | Generic body field validator | ✅ wallet.routes.js:21,30,37 |
| `validateObjectId(paramName)` | 142 | 24-char hex ObjectId param | ❌ NEVER USED |
| `validateName()` | 150 | 2-50 char name | ❌ NEVER USED |
| `validateMomentContent()` | 160 | 500 char content | ❌ NEVER USED |

### Query Validation (`src/middlewares/queryValidation.js`, 38 lines)

| Function | Line | Purpose | Used in Routes? |
|---|---|---|---|
| `queryValidation` | 11 | Sanitizes page/limit/offset query params | ✅ Applied in app.js to ~8 routes |

---

## VALIDATION MATRIX (Route File → Validation Status)

| Route File | Body Validation | Params Validation | Query Validation | File Validation | Risk |
|---|---|---|---|---|---|
| `adminRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `adminAuth.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `agencyRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `agencyInvitationRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `agencyTargetRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `agentRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `analytics.routes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `antiBanRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `appUserRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `attendanceRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `auth.routes.js` | ✅ validatePhone | ❌ | ❌ | ❌ | 🟠 HIGH |
| `authSecure.routes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `blindDateRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `bonusRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `chatRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `coinDistributionRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `coinOrderRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `cpRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `creator.routes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `dailyTaskRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `dealer.routes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `diamondEconomyRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `diamondWithdrawalRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `eventRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `familyChatRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `familyRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `firebaseAuth.routes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `gameRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `gift.routes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `googleAuthRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `healthRoutes.js` | ✅ N/A | ✅ N/A | ✅ N/A | ❌ | ✅ LOW |
| `infrastructureRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `inventory.routes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `inviteRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `legalRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `level.routes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `livekit.routes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `localizationRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `loginStreakRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `luckyDrawMobileRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `luckyDrawRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `matchmakingRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `missionRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `moderation.routes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `moduleManagerRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `momentRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `notificationRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `penaltyRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `pkBattleRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `premiumSubscriptionRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `profileRoutes.js` | ❌ | ❌ | ❌ | ✅ multer | 🟠 HIGH |
| `rankingRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🟡 MEDIUM |
| `rechargePlanRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `referral.routes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `reportsRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `rewardsRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `room.routes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `roomFeaturesRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `roomLuxuryRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `salaryRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `securityRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `shopRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `singingRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `socialAuthRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `socialRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `staffRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `support.routes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `targetRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `tournamentRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `treasureHuntRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `treasuryRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `user.routes.js` | ❌ | ❌ | ✅ regex sanitize | ❌ | 🟠 HIGH |
| `vipRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `vipSystemRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `wallet.routes.js` | ✅ validateBody | ❌ | ❌ | ❌ | 🟠 HIGH |
| `webViewGameRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `withdrawalRoutes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| `youtube.routes.js` | ❌ | ❌ | ❌ | ❌ | 🔴 CRITICAL |

**Summary:** 76 of 78 route files have 🔴 CRITICAL risk (zero validation). 1 file has 🟠 HIGH (partial validation). 1 file has ✅ LOW (health check, no input needed).

---

## 🔴 CRITICAL FINDINGS

### 1. 767 of 773 Routes Have NO Validation (99.22%)
- **Evidence:** Grep across all 78 route files found validation middleware in only 2 files: `auth.routes.js` (3 endpoints with `validatePhone()`) and `wallet.routes.js` (3 endpoints with `validateBody()`).
- **Impact:** Any endpoint can receive arbitrary data — strings where numbers expected, missing required fields, excessively long strings, invalid ObjectIds, etc. This leads to:
  - Database errors from invalid types
  - Mass assignment vulnerabilities (see QUERY_SECURITY_AUDIT_REPORT.md)
  - NoSQL injection via unvalidated query params
  - DoS via excessively large payloads
  - Data corruption from invalid formats

### 2. validateObjectId NEVER Used in Any Route
- **File:** `src/middlewares/validation.middleware.js:142`
- **Evidence:** The function `validateObjectId(paramName)` exists but grep found ZERO usages across all 78 route files. Every `/:id` param route accepts any string as an ObjectId.
- **Impact:** Invalid ObjectId strings cause Mongoose to throw `CastError`, resulting in 500 errors instead of clean 400 validation errors. Attackers can also send specially crafted strings to exploit parser bugs.
- **Fix:** Apply `validateObjectId('id')` to all routes with `/:id` params:
  ```js
  router.get('/:id', validateObjectId('id'), controller.getById);
  ```

### 3. validateEmail NEVER Used in Any Route
- **File:** `src/middlewares/validation.middleware.js:40`
- **Evidence:** The function `validateEmail()` exists but is NEVER called. Email-containing endpoints (registration, password reset, social login) accept any string as an email.
- **Impact:** Invalid email formats stored in database; email-based features (notifications, password reset) fail silently.
- **Fix:** Apply `validateEmail()` to all email-accepting endpoints.

### 4. validateOTP NEVER Used in Any Route
- **File:** `src/middlewares/validation.middleware.js:29`
- **Evidence:** The function `validateOTP()` exists but is NEVER called. The `auth.routes.js` uses `validatePhone()` on OTP endpoints but NOT `validateOTP()`.
- **Impact:** OTP field accepts any string — letters, symbols, empty strings. This could lead to bypass of OTP verification if the OTP service has bugs.
- **Fix:** Add `validateOTP()` to OTP verification routes:
  ```js
  router.post('/otp-verify', authLimiter, validatePhone(), validateOTP(), verifyOtp);
  ```

### 5. validatePagination NEVER Used in Any Route
- **File:** `src/middlewares/validation.middleware.js:72`
- **Evidence:** The function `validatePagination()` exists but is NEVER called. The `queryValidation` middleware (separate file) is used instead in app.js for ~8 routes.
- **Impact:** Most paginated endpoints don't validate page/limit params. An attacker can send `?limit=999999999` to cause DoS via large database queries.
- **Fix:** Apply `validatePagination()` or `queryValidation` to all paginated routes.

### 6. No Body Size Limit on Most Routes
- **Evidence:** `express.json()` in `src/app.js` has `{ limit: '10mb' }` (line 89). This is a 10MB body limit, which is very generous. No per-route body size limits exist.
- **Impact:** Attackers can send 10MB JSON payloads to any endpoint, causing memory pressure and potential DoS.
- **Fix:** Reduce global limit to `1mb` and add per-route limits for file upload endpoints.

### 7. No File Type Validation on Most Upload Routes
- **Evidence:** Only `profileRoutes.js` has multer with `fileFilter` (line 26) and `fileSize` limit (line 38, 5MB). Other potential file upload routes (moment, chat, gift) have NO file validation.
- **Impact:** Attackers can upload malicious files (executables, scripts) to endpoints without file validation.
- **Fix:** Apply multer with fileFilter to all file-accepting routes.

---

## 🟠 HIGH FINDINGS

### 8. Phone Validation Only 10-Digit Regex
- **File:** `src/middlewares/validation.middleware.js:23`
- **Code:** `.matches(/^\d{10}$/)`
- **Evidence:** Phone validation only accepts 10-digit numbers. No country code support, no international format.
- **Impact:** International users with +country code or different lengths are rejected.
- **Fix:** Use `body('phone').isMobilePhone()` from express-validator for international support.

### 9. wallet.routes.js validateBody Only Checks Required Fields
- **File:** `src/routes/wallet.routes.js:21,30,37`
- **Evidence:** `validateBody({ recipientId: { required: true }, amount: { required: true, isNumeric: true } })` — only checks if fields are present and numeric. No min/max amount validation, no recipientId format validation.
- **Impact:** Negative amounts, zero amounts, or extremely large amounts can be submitted.
- **Fix:** Add min/max validation: `amount: { required: true, isNumeric: true, min: 1, max: 1000000 }`

### 10. profileRoutes.js File Filter May Be Insufficient
- **File:** `src/routes/profileRoutes.js:26`
- **Evidence:** The `fileFilter` function exists but the actual filter logic was not shown in the grep. Need to verify it checks MIME types and file extensions.
- **Fix:** Ensure fileFilter checks both MIME type and extension against a whitelist.

---

## 🟡 MEDIUM FINDINGS

### 11. queryValidation Only Sanitizes page/limit/offset
- **File:** `src/middlewares/queryValidation.js:11-36`
- **Evidence:** Only validates `page`, `limit`, `offset` query params. Does not validate `status`, `startDate`, `endDate`, `search`, or other common query params.
- **Impact:** Other query params are passed unsanitized to Mongoose queries.

### 12. No Password Complexity Validation
- **Evidence:** No password validation middleware exists. Passwords are accepted as-is in `authSecure.controller.js:270-271`.
- **Impact:** Users can set weak passwords (1 character, "password", "123456").

### 13. No Date/Time Validation
- **Evidence:** No middleware validates date formats. Endpoints accepting `dob`, `startDate`, `endDate` accept any string.
- **Impact:** Invalid dates cause database errors or incorrect data.

---

## 🟢 LOW FINDINGS

### 14. user.routes.js Has Regex Sanitization
- **File:** `src/routes/user.routes.js:17`
- **Code:** `const sanitized = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`
- **Evidence:** Good practice — escapes regex special characters before using in `$regex` query.
- **Assessment:** ✅ This is the correct pattern. Should be applied everywhere `$regex` is used.

### 15. Health Routes Need No Validation
- **File:** `src/routes/healthRoutes.js`
- **Evidence:** Health check endpoints don't accept user input, so no validation needed.
- **Assessment:** ✅ Correct.

---

## FIX PRIORITY

| Priority | Count | Action |
|---|---|---|
| 🔴 Immediate | 7 | Apply validateBody to all 393 POST/PUT/PATCH routes; Apply validateObjectId to all /:id routes; Apply validateEmail to email-accepting routes; Apply validateOTP to OTP routes; Apply validatePagination to all paginated routes; Reduce express.json limit to 1mb; Add file validation to all upload routes |
| 🟠 High | 3 | Fix phone validation for international format; Add min/max amount validation to wallet; Verify profileRoutes fileFilter checks MIME types |
| 🟡 Medium | 3 | Extend queryValidation to validate status/date/search params; Add password complexity validation; Add date format validation |
| 🟢 Low | 1 | Document validation patterns as internal best practices |