# BACKEND_AUDIT_REPORT.md — voice-chat-backend1

## 1. CORS / Connectivity Fixes

### Problem
Mobile apps (Flutter Dio/http) do NOT send `Origin` headers. The old `cors.js` rejected all no-origin requests in `NODE_ENV=production`, meaning the **entire mobile app was blocked**.

### Fix Applied
- **`src/config/cors.js`**: No-origin requests (mobile, curl, server-to-server) are now always allowed. Browser requests with `Origin` header are still validated against `ALLOWED_ORIGINS`.
- **`server.js`**: Socket.IO CORS now reads from `ALLOWED_ORIGINS` env var. Removed hardcoded `192.168.1.100` LAN IP.
- **`src/sockets/socketManager.js`**: Removed hardcoded production domain origins; now uses `ALLOWED_ORIGINS` env var with localhost fallback.

---

## 2. Socket.IO Security Fix

### Problem
Default namespace (`io.on('connection', ...)`) had **NO JWT auth middleware**. Any unauthenticated client could connect and fire sensitive events (gifts, wallet, room joins, PK battles). Only `/youtube` namespace had auth.

### Fix Applied
- **`src/sockets/index.js`**: Added `io.use(socketAuthMiddleware)` BEFORE all namespace registrations. Now ALL default namespace connections must provide a valid JWT token. Auth checks token from `auth.token`, `query.token`, or `Authorization` header.

---

## 3. HTTP → HTTPS Migration Readiness

### Changes
- Added `APP_BASE_URL` env var to `.env.example` and `.env.template` (`http://222.167.207.78:5000`)
- **`src/controllers/referralController.js`**: Replaced hardcoded `https://arvindparty.com` with `process.env.APP_BASE_URL`
- **`src/controllers/userController.js`**: Removed Razorpay placeholder secret fallbacks (`'YOUR_RAZORPAY_SECRET'`). Now fails loudly if env vars are missing.

### Domain Migration Checklist
| Step | File | What to Change |
|------|------|----------------|
| 1 | `.env` | `APP_BASE_URL=https://yourdomain.com` |
| 2 | `.env` | `ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com` |
| 3 | `.env` | `LIVEKIT_WS_URL=wss://livekit.yourdomain.com` (if self-hosted) |
| 4 | `.env` | `NODE_ENV=production` |
| 5 | No code changes needed | All URLs are now env-driven |

---

## 4. Security Issues Found & Fixed

| Severity | Issue | Fix |
|----------|-------|-----|
| **CRITICAL** | Socket.IO default namespace had no auth | Added global `io.use(socketAuthMiddleware)` |
| **CRITICAL** | Razorpay `verifyPayment` used `'YOUR_RAZORPAY_SECRET'` as fallback — payment verification would silently pass with dummy secret | Now returns 503 if env var is missing/placeholder |
| **CRITICAL** | Razorpay `razorpayWebhook` used `'YOUR_WEBHOOK_SECRET'` as fallback — webhook signature check bypassed | Now returns 503 if env var is missing |
| **HIGH** | CORS blocked all mobile app requests in production mode | No-origin requests now always allowed |
| **HIGH** | Hardcoded `192.168.1.100` LAN IP in Socket.IO CORS | Removed; uses `ALLOWED_ORIGINS` env var |
| **MEDIUM** | Referral links hardcoded to `arvindparty.com` | Uses `APP_BASE_URL` env var now |
| **LOW** | `socketManager.js` duplicated CORS config | Synced with `ALLOWED_ORIGINS` env var |

---

## 5. NODE_ENV Recommendation

**Abhi testing ke liye `NODE_ENV=development` rakho.**

Reasons:
- Auth rate limits: 1000 req/15min (vs 5 in production) — needed for testing
- OTP rate limits: 1000 req/min (vs 3 in production)
- Auto-scaling disabled in dev mode (saves resources)
- Backup service disabled in dev mode

Sirf tab `production` karo jab:
1. Domain + SSL certificate ready ho
2. Real MongoDB Atlas cluster configured
3. Razorpay production keys set
4. Firebase production project configured

---

## 6. Route/API Sanity Check

69 route groups registered in `src/app.js`. Key mobile-app routes confirmed:

| Mobile Feature | Route | Auth Middleware |
|---------------|-------|-----------------|
| Login/Signup | `/api/auth/*` | authLimiter |
| Phone OTP | `/api/auth/phone-login`, `/api/auth/verify-otp` | authLimiter + otpLimiter |
| Firebase Auth | `/api/auth/firebase` | authLimiter |
| User Profile | `/api/users/*` | authMiddleware |
| Rooms | `/api/rooms/*` | authMiddleware |
| Gifts | `/api/gifts/*` | authMiddleware |
| Wallet/Recharge | `/api/wallet/*` | authMiddleware |
| Family | `/api/families/*` | authMiddleware |
| Agency | `/api/agency/*` | authMiddleware |
| Rankings | `/api/rankings/*` | authMiddleware |
| LiveKit Token | `/api/room/*`, `/api/livekit/*` | authMiddleware |
| Chat | `/api/chat/*` | authMiddleware |
| Moments | `/api/moments/*` | authMiddleware |

No duplicate route path conflicts detected.

---

## 7. Environment Variables (.env) — Quick Reference

### Required (server won't start):
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `MONGO_URI`
- `PORT`

### Core Application:
- `NODE_ENV` = `development` (abhi testing ke liye)
- `ALLOWED_ORIGINS` = comma-separated origins
- `APP_BASE_URL` = `http://222.167.207.78:5000` (abhi ke liye)

### Payment:
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`

### Media/Audio:
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### Auth:
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

### Monitoring (optional):
- `SENTRY_DSN`
