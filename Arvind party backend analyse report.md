# 🦁 Arvind Party Backend — Comprehensive Analysis Report

> **Generated:** 12 June 2026  
> **Workspace:** `d:\Alarms\arvind-party-backend`  
> **Engine:** Node.js + Express + MongoDB Atlas + Socket.io  
> **Version:** 1.0.0  

---

## 1. 📁 Current Project Architecture

### 1.1 Entry Points

| File | Role | Notes |
|------|------|-------|
| `server.js` | **Primary entry** (`npm start`/`npm run dev`) | Creates HTTP server, connects DB, initializes Socket.io + Redis |
| `src/app.js` | Express app definition | Mounts 15 route groups, middleware, error handler |
| `src/api/app.js` | **Legacy/alternate entry** | Standalone Express app with its own Socket.io — **NOT wired to main server** |
| `setup_folders.js` | One-time folder scaffolding utility | References `src/modules/` folders that were never fully populated |

### 1.2 Directory Structure

```
arvind-party-backend/
├── server.js                  # Main bootstrap
├── package.json
├── .env
├── src/
│   ├── app.js                 # Express app + route mounting
│   ├── config/
│   │   ├── db.js              # MongoDB Atlas connection (Mongoose)
│   │   ├── firebase.js        # Firebase Admin SDK init
│   │   └── socket.js          # Socket.io factory (initializeSocket/getIO)
│   ├── controllers/           # 25 controller files
│   ├── routes/                # 19 route files
│   ├── models/                # 31 Mongoose model files
│   ├── sockets/               # 5 Socket.io handler files
│   ├── middlewares/           # 5 middleware files
│   ├── services/otp.service.js
│   ├── utils/jwt.js
│   ├── modules/shop/          # Frame shop sub-module (3 files)
│   └── api/                   # Legacy standalone app (unused)
```

### 1.3 Database Configuration (MongoDB Atlas)

- **File:** `src/config/db.js`
- **Driver:** Mongoose v8.3.4
- **URI:** `process.env.MONGO_URI` → fallback `mongodb://127.0.0.1:27017/arvind-party`
- **Timeout:** 5s (`serverSelectionTimeoutMS: 5000`)
- **Graceful degradation:** Server continues without DB on failure

### 1.4 Mongoose Models (31 files)

| Model | Purpose |
|-------|---------|
| `User.js` | Core user accounts (uid, firebaseUid, phone, role, xp, level, VIP, KYC, ban) |
| `Room.js` | Live voice rooms (10 embedded seats, owner, status) |
| `RoomSeat.js` | Separate seat model (**unused** — seats embedded in Room) |
| `RoomMessage.js` | Room chat messages |
| `Gift.js` / `GiftEvent.js` / `GiftTransaction.js` | Gift catalog, events, transactions |
| `Agency.js` | Host agencies |
| `Badge.js` | Achievement badges with unlock conditions |
| `Family.js` | Family/guild system |
| `CpPair.js` | Couple pair relationships |
| `PKBattle.js` | PK battle records |
| `Ranking.js` | Leaderboard snapshots |
| `GameRecord.js` | Game play logs |
| `LuckyDrawReward.js` | Lucky wheel reward pool |
| `MissionProgress.js` | Daily mission tracking |
| `Transaction.js` | Razorpay payment transactions |
| `WalletTransaction.js` | Wallet recharge/transfer logs |
| `Withdrawal.js` / `Recharge.js` | Cash-out / top-up records |
| `Staff.js` | Staff accounts (loginId, role, permissions) |
| `VipPlan.js` / `VipUser.js` | VIP plans and subscriptions |
| `TreasuryLog.js` | Coin generation audit trail |
| `GlobalSetting.js` | System-wide settings |
| `SystemSettings.js` | Duplicate of GlobalSetting (**unused**) |
| `AuditLog.js`, `Announcement.js`, `RaiseHand.js`, `Settlement.js`, `Invoice.js` | Scaffolded but **unused** |

### 1.5 Route Mounting (from `src/app.js`)

| Mount Path | Route File | Controller |
|-----------|-----------|-----------|
| `/api/auth` | `auth.routes.js` | `auth.controller.js` |
| `/api/users` | `user.routes.js` | `userController.js` |
| `/api/admin` | `adminRoutes.js` | `admin.user.controller.js` |
| `/api/staff` | `staffRoutes.js` | `staffController.js` |
| `/api/rooms` | `room.routes.js` | `room.controller.js` |
| `/api/gifts` | `gift.routes.js` | `gift.controller.js` |
| `/api/wallet` | `wallet.routes.js` | `walletController.js` |
| `/api/agency` | `agencyRoutes.js` | `agencyController.js` |
| `/api/pk-battles` | `pkBattleRoutes.js` | `pkBattle.controller.js` |
| `/api/families` | `familyRoutes.js` | `familyController.js` |
| `/api/shop` | `shopRoutes.js` | `shop.controller.js` |
| `/api/games` | `gameRoutes.js` | `game.controller.js` |
| `/api/cp` | `cpRoutes.js` | `cpController.js` |
| `/api/treasury` | `treasuryRoutes.js` | `treasuryController.js` |
| `/api/matchmaking` | `matchmakingRoutes.js` | `matchmaking.controller.js` |

**⚠️ NOT mounted:** `chatRoutes.js`, `rankingRoutes.js`, `vipRoutes.js`, `modules/shop/shop.routes.js`

### 1.6 Security & Middleware Stack

| Middleware | Purpose |
|-----------|---------|
| `helmet` | XSS, clickjacking protection |
| `cors (origin: *)` | Cross-origin requests |
| `express.json` (10MB) | Body parsing |
| `express-rate-limit` (1000/15min) | Rate limiting |
| `auth.middleware.js` | JWT Bearer verification |
| `adminMiddleware.js` | Staff/Owner RBAC |
| `errorHandler.middleware.js` | Global error handler |
| `validation.middleware.js` | **Defined but never applied** |
| `isAdmin.js` | **Orphaned — never used** |

### 1.7 Socket.io Architecture

| Handler File | Events (Client → Server) | Events (Server → Client) |
|-------------|--------------------------|-------------------------|
| `roomSocket.js` | `join_room`, `leave_room`, `toggle_mic`, `kick_user`, `admin_mute_user`, `unkick_user`, `admin_unmute_user` | `user_joined`, `user_left`, `mic_status_changed`, `user_kicked`, `user_admin_muted`, `user_unkicked`, `user_admin_unmuted` |
| `chatSocket.js` | `send_room_message`, `send_reaction` | `receive_room_message`, `receive_reaction` |
| `seatSocket.js` | `claim_seat` | `seat_updated`, `seat_error` |
| `giftSocket.js` | `send_gift` | `gift_animation`, `gift_error` |
| `pkBattleSocket.js` | `request_pk`, `pk_send_gift` | `pk_started`, `pk_update`, `pk_ended` |

Additional socket events emitted from controllers:
- `receive_gift` (from `gift.controller.js` via REST API)
- `pk_request`, `pk_start`, `pk_end` (from `pkBattle.controller.js`)
- `webhook_payment_success` (from `userController.js` Razorpay webhook)
- `badge_unlocked` (from `gameController.js` cron job)
- `force_logout` (from `admin.user.controller.js` ban action)

---

## 2. 🐛 Code Health & Bugs

### 2.1 🔴 CRITICAL — Broken Imports (Crashes at Startup)

| # | Missing File / Bad Path | Imported By | Impact |
|---|------------------------|------------|--------|
| 1 | `src/middlewares/authMiddleware.js` **DOES NOT EXIST** | `adminRoutes.js:4`, `pkBattleRoutes.js:4`, `gameRoutes.js:4`, `cpRoutes.js:4` | **4 route groups crash.** Actual file is `auth.middleware.js` |
| 2 | `require('../../authMiddleware')` (wrong path) | `matchmakingRoutes.js:4` | Resolves to root — file not found. **Matchmaking crashes** |
| 3 | `require('./wallet.controller')` (wrong relative path) | `wallet.routes.js:3` | Resolves to `src/routes/wallet.controller.js` — doesn't exist. **All wallet routes crash** |
| 4 | `require('../models/Message')` | `chatController.js:1` | No `Message` model. Actual: `RoomMessage`. **Chat history crashes** |
| 5 | `require('../models/RoomMember')` | `room.production.controller.js:2` | No `RoomMember` model. **Production room details crashes** |
| 6 | `require('node-cron')` | `gameController.js:3` | **Not in package.json.** `npm install` won't install it |
| 7 | `require('stripe')` | `walletController.js:4` | **Not in package.json.** Stripe import will fail |

### 2.2 🔴 CRITICAL — Admin Routes Middleware Mismatch

`adminRoutes.js:9` calls `adminMiddleware('APP.ADMIN.WEB')` as a **function with a parameter**, but `adminMiddleware.js` exports an **object** `{ verifyStaff, verifyOwner, requirePermission }` — not a callable function. This will throw `TypeError: adminMiddleware is not a function` at startup.

### 2.3 🔴 CRITICAL — JWT Secret Inconsistency

Different files use **different fallback JWT secrets**:

| File | Fallback Secret |
|------|----------------|
| `auth.controller.js` (login) | `arvind-party-secret` |
| `auth.controller.js` (verifyOtp) | `supersecret_arvind_party` |
| `auth.middleware.js` | `arvind_party_super_secret_key` |
| `staffController.js` | `arvind_party_super_secret_key` |
| `utils/jwt.js` | `arvind_party_secret_key` |
| `adminAuthController.js` | `arvind_party_secret` |

**Tokens generated by one controller will be rejected by other middleware.** If `JWT_SECRET` is not set in `.env`, tokens from `auth.controller.js` will fail `auth.middleware.js` verification.

### 2.4 🟡 HIGH — User Model Schema Mismatch

The `User.js` model defines: `uid`, `firebaseUid`, `phone`, `email`, `username`, `displayName`, `avatar`, `role`, `xp`, `level`, `vipLevel`, `vipExpiresAt`, `isBanned`, `banReason`.

Controllers reference **fields that do NOT exist** in the schema:
- `coins`, `diamonds` (used in gift, wallet, game, shop, treasury, admin controllers)
- `equippedFrame`, `unlockedFrames`, `ownedFrames` (userController, shop)
- `arvindId` (auth.controller.js login, user.routes)
- `isProfileComplete` (auth.controller.js)
- `familyId`, `familyRole` (familyController.js)
- `agencyId` (agencyController, appUserController)
- `badges` array (badgeController.js)
- `activeFrame`, `activeCar` (adminController.js)
- `followers`, `following`, `cpPartner`, `cpRequests`, `cpLevel` (social.routes.js)
- `vipExpiry` (userController.js — but model has `vipExpiresAt`)
- `isBlocked` (adminController.js — but model has `isBanned`)

**Mongoose will silently ignore undefined fields on `save()`, causing data loss.**

### 2.5 🟡 HIGH — Room Model Schema Mismatch

Controllers reference fields not in `Room.js` schema:
- `room.kickedUsers`, `room.mutedUsers` (roomSocket.js) — not in schema
- `room.status === 'live'` (room.controller.js) — schema only has `'active' | 'inactive' | 'banned'`
- `room.name` (room.controller.js createRoom) — schema field is `title`, not `name`

### 2.6 🟡 HIGH — Duplicate / Conflicting Logic

| Issue | Details |
|-------|---------|
| Duplicate Lucky Wheel | `game.controller.js` (DB-driven rewards) AND `gameController.js` (hardcoded rewards) — both have spin logic |
| Duplicate getAllUsers | `adminController.js:8` AND `admin.user.controller.js:8` |
| Duplicate OTP system | `auth.controller.js` uses in-memory `otpStore` Map; `otp.service.js` uses Redis with Twilio — **not integrated** |
| Duplicate gift sending | `gift.controller.js` (REST) and `giftSocket.js` (Socket) — different commission logic |

### 2.7 🟡 MEDIUM — Security Concerns

| Issue | Details |
|-------|---------|
| Hardcoded admin credentials | `adminAuthController.js:8-9` — `arvind_admin` / `admin@arvind2025` as defaults |
| Hardcoded JWT secrets | 5 different fallback secrets (see 2.3) |
| CORS `origin: '*'` | Wide open — any domain can access the API |
| No auth on wallet routes | `wallet.routes.js:5` has `// TODO: Add authMiddleware` |
| No auth on chat route | `chatRoutes.js` — `getChatHistory` has no auth middleware |
| OTP bypass for test accounts | `auth.controller.js:63` — phone ending in `0000000000` always gets OTP `123456` |
| `x-admin-key` header bypass | `adminMiddleware.js:10-17` — anyone who knows the secret key can act as OWNER |
| `firebase-service-account.json` required | `firebase.js:5` — server crashes if file missing (not in repo) |
| `recharge` endpoint credits without verification | `walletController.js:21-43` — directly adds coins without payment gateway confirmation |

### 2.8 🟢 LOW — Minor Issues

- `staffController.js:1` imports `bcrypt` but `package.json` has `bcryptjs` (may resolve via npm but API may differ)
- `otp.service.js:44` — `!process.env.TWILIO_ENABLED === 'true'` is always truthy because `!string` → `false`, then `false === 'true'` → `false`. The actual check should be `process.env.TWILIO_ENABLED !== 'true'`
- `validation.middleware.js` — Validation functions are defined but **never applied** to any route
- `isAdmin.js` — Simple middleware that checks `req.user.role === 'admin'` — **orphaned, never used**
- `setup_folders.js` — References module folders (`src/modules/auth`, `src/modules/room`, etc.) that were never populated
- `gameController.js:4` imports `MissionProgress` — used in game logic but mission controller has its own reset logic, causing potential race conditions
- `src/api/` directory is a completely separate legacy app — duplicated effort

---

## 3. 🌐 API Endpoint & Socket.io Audit

### 3.1 Complete REST API Endpoint List

#### Authentication

| Method | Endpoint | Auth | Controller | Status |
|--------|----------|------|-----------|--------|
| POST | `/api/auth/login` | None | `auth.controller.login` | ⚠️ Uses in-memory OTP, not Redis/Twilio |

#### User Profile

| Method | Endpoint | Auth | Controller | Status |
|--------|----------|------|-----------|--------|
| POST | `/api/users/complete-profile` | JWT | `userController.updateProfile` | ✅ Works |
| GET | `/api/users/center` | JWT | `userController.getUserCenter` | ✅ Works (fallback badges) |
| POST | `/api/users/equip-frame` | JWT | `userController.equipFrame` | ✅ Works |

#### Admin

| Method | Endpoint | Auth | Controller | Status |
|--------|----------|------|-----------|--------|
| GET | `/api/admin/users` | Admin (broken) | `admin.user.controller.getAllUsers` | 🔴 Auth middleware crash |
| POST | `/api/admin/users/ban` | Admin (broken) | `admin.user.controller.toggleBanStatus` | 🔴 Auth middleware crash |

#### Staff Management

| Method | Endpoint | Auth | Controller | Status |
|--------|----------|------|-----------|--------|
| POST | `/api/staff/login` | None | `staffController.loginStaff` | ✅ Works |
| POST | `/api/staff/create` | Owner | `staffController.createStaff` | ✅ Works |
| GET | `/api/staff/list` | Owner | `staffController.getStaffList` | ✅ Works |
| PUT | `/api/staff/update/:id` | Owner | `staffController.updateStaff` | ✅ Works |
| DELETE | `/api/staff/delete/:id` | Owner | `staffController.deleteStaff` | ✅ Works |

#### Rooms

| Method | Endpoint | Auth | Controller | Status |
|--------|----------|------|-----------|--------|
| GET | `/api/rooms/live` | None | `room.controller.getLiveRooms` | ⚠️ Room.status mismatch (`live` vs `active`) |
| POST | `/api/rooms/create` | JWT | `room.controller.createRoom` | ⚠️ Uses `name` field but schema has `title` |

#### Gifts

| Method | Endpoint | Auth | Controller | Status |
|--------|----------|------|-----------|--------|
| GET | `/api/gifts/list` | JWT | `gift.controller.getGifts` | ✅ Works |
| POST | `/api/gifts/send` | JWT | `gift.controller.sendGift` | ✅ Works (with commission engine) |

#### Wallet

| Method | Endpoint | Auth | Controller | Status |
|--------|----------|------|-----------|--------|
| GET | `/api/wallet` | **None (TODO)** | `walletController.getWallet` | 🔴 Broken import + no auth |
| POST | `/api/wallet/recharge` | **None** | `walletController.recharge` | 🔴 Broken import — adds coins without payment verification |
| POST | `/api/wallet/recharge/stripe/intent` | **None** | `walletController.createStripeIntent` | 🔴 Broken import + missing `stripe` package |
| POST | `/api/wallet/recharge/razorpay/order` | **None** | `walletController.createRazorpayOrder` | 🔴 Broken import |
| GET | `/api/wallet/transactions` | **None** | `walletController.getTransactions` | 🔴 Broken import |
| GET | `/api/wallet/withdrawal-info` | **None** | `walletController.getWithdrawalInfo` | 🔴 Broken import |
| POST | `/api/wallet/seller/transfer` | **None** | `walletController.coinSellerTransfer` | 🔴 Broken import |
| POST | `/api/wallet/withdraw` | **None** | `walletController.withdraw` | 🔴 Broken import |

#### Agency

| Method | Endpoint | Auth | Controller | Status |
|--------|----------|------|-----------|--------|
| GET | `/api/agency/mine` | JWT | `agencyController.getMyAgency` | ✅ Works |
| POST | `/api/agency/apply` | JWT | `agencyController.applyForAgency` | ✅ Works |

#### PK Battles

| Method | Endpoint | Auth | Controller | Status |
|--------|----------|------|-----------|--------|
| POST | `/api/pk-battles/request` | JWT (broken) | `pkBattle.controller.requestBattle` | 🔴 Auth middleware crash |
| POST | `/api/pk-battles/accept` | JWT (broken) | `pkBattle.controller.acceptBattle` | 🔴 Auth middleware crash |
| POST | `/api/pk-battles/end` | JWT (broken) | `pkBattle.controller.endBattle` | 🔴 Auth middleware crash |

#### Families

| Method | Endpoint | Auth | Controller | Status |
|--------|----------|------|-----------|--------|
| GET | `/api/families/mine` | JWT | `familyController.getMyFamily` | ✅ Works |
| POST | `/api/families/create` | JWT | `familyController.createFamily` | ✅ Works |
| POST | `/api/families/join` | JWT | `familyController.joinFamily` | ✅ Works |

#### Shop

| Method | Endpoint | Auth | Controller | Status |
|--------|----------|------|-----------|--------|
| GET | `/api/shop/items` | JWT | `shop.controller.getItems` | ⚠️ Returns hardcoded items |
| POST | `/api/shop/purchase` | JWT | `shop.controller.purchaseItem` | ⚠️ Hardcoded 500 diamond price |

#### Games

| Method | Endpoint | Auth | Controller | Status |
|--------|----------|------|-----------|--------|
| GET | `/api/games/lucky-wheel/rewards` | JWT (broken) | `game.controller.getLuckyWheelRewards` | 🔴 Auth middleware crash |
| POST | `/api/games/lucky-wheel/spin` | JWT (broken) | `game.controller.spinLuckyWheel` | 🔴 Auth middleware crash |

#### Couple Pair (CP)

| Method | Endpoint | Auth | Controller | Status |
|--------|----------|------|-----------|--------|
| GET | `/api/cp/mine` | JWT (broken) | `cpController.getMyCp` | 🔴 Auth middleware crash |
| POST | `/api/cp/bind` | JWT (broken) | `cpController.bindCp` | 🔴 Auth middleware crash |

#### Treasury

| Method | Endpoint | Auth | Controller | Status |
|--------|----------|------|-----------|--------|
| POST | `/api/treasury/generate` | Owner | `treasuryController.generateCoins` | ✅ Works (log-only, no user credit) |
| GET | `/api/treasury/logs` | Owner | `treasuryController.getLogs` | ✅ Works |

#### Matchmaking

| Method | Endpoint | Auth | Controller | Status |
|--------|----------|------|-----------|--------|
| POST | `/api/matchmaking/search` | JWT (broken) | `matchmaking.controller.searchMatch` | 🔴 Broken import path |
| POST | `/api/matchmaking/stop` | JWT (broken) | `matchmaking.controller.stopSearch` | 🔴 Broken import path |

#### Utility Routes (in `src/app.js`)

| Method | Endpoint | Auth | Status |
|--------|----------|------|--------|
| GET | `/` | None | ✅ API welcome message |
| GET | `/health` | None | ✅ Health check |

#### ⚠️ NOT MOUNTED Routes (exist in files but not wired)

| File | Endpoints | Issue |
|------|-----------|-------|
| `chatRoutes.js` | `GET /chat/history/:userId/:targetId` | Not imported in `app.js` + broken model import |
| `rankingRoutes.js` | `GET /ranking/wealth`, `GET /ranking/charm` | Not imported in `app.js` |
| `vipRoutes.js` | VIP plan routes | Not imported in `app.js` |
| `modules/shop/shop.routes.js` | `GET /frames`, `POST /buy-frame` | Not imported in `app.js` |

### 3.2 Complete Socket.io Event List

#### Room Events (`roomSocket.js`)

| Event (Client→Server) | Payload | Response (Server→Client) |
|----------------------|---------|-------------------------|
| `join_room` | `{ roomId, userId, userProfile }` | `user_joined` / `user_kicked` / `user_admin_muted` |
| `leave_room` | `{ roomId, userId, userProfile }` | `user_left` |
| `toggle_mic` | `{ roomId, userId, isMuted }` | `mic_status_changed` |
| `kick_user` | `{ roomId, targetUserId, adminId }` | `user_kicked` |
| `admin_mute_user` | `{ roomId, targetUserId, adminId }` | `user_admin_muted` |
| `unkick_user` | `{ roomId, targetUserId, adminId }` | `user_unkicked` |
| `admin_unmute_user` | `{ roomId, targetUserId, adminId }` | `user_admin_unmuted` |

#### Chat Events (`chatSocket.js`)

| Event (Client→Server) | Payload | Response |
|----------------------|---------|----------|
| `send_room_message` | `{ roomId, senderId, message }` | `receive_room_message` (broadcast) |
| `send_reaction` | `{ roomId, ... }` | `receive_reaction` (broadcast) |

#### Seat Events (`seatSocket.js`)

| Event (Client→Server) | Payload | Response |
|----------------------|---------|----------|
| `claim_seat` | `{ roomId, userId, userName, userAvatar, seatIndex }` | `seat_updated` / `seat_error` |

#### Gift Socket Events (`giftSocket.js`)

| Event (Client→Server) | Payload | Response |
|----------------------|---------|----------|
| `send_gift` | `{ roomId, senderId, receiverId, giftId, quantity }` | `gift_animation` / `gift_error` |

#### PK Battle Socket Events (`pkBattleSocket.js`)

| Event (Client→Server) | Payload | Response |
|----------------------|---------|----------|
| `request_pk` | `{ targetRoomId }` | `pk_started` |
| `pk_send_gift` | `{ battleId, hostNumber, giftValue }` | `pk_update` |
| (auto) timer expiry | — | `pk_ended` |

#### Controller-Emitted Socket Events

| Source | Event | When |
|--------|-------|------|
| `gift.controller.js` | `receive_gift` | After REST API gift send |
| `pkBattle.controller.js` | `pk_request` | Battle request sent |
| `pkBattle.controller.js` | `pk_start` | Battle accepted |
| `pkBattle.controller.js` | `pk_end` | Battle ended |
| `admin.user.controller.js` | `force_logout` | User banned |
| `userController.js` | `webhook_payment_success` | Razorpay webhook processed |
| `gameController.js` | `badge_unlocked` | Weekly champion crowned |

---

## 4. 📱 Frontend Readiness Log

### 4.1 Flutter Mobile App Routes

| Route | Backend Endpoint | Ready? | Notes |
|-------|-----------------|--------|-------|
| Phone Login (OTP) | `POST /api/auth/login` | ⚠️ | Auth controller uses in-memory OTP, no real SMS. sendOtp/verifyOtp exist but have no mounted route |
| Complete Profile | `POST /api/users/complete-profile` | ✅ | Works with JWT auth |
| User Center | `GET /api/users/center` | ✅ | Returns badges, frames, level info |
| Equip Frame | `POST /api/users/equip-frame` | ✅ | |
| Get Live Rooms | `GET /api/rooms/live` | ⚠️ | Room status filter uses `live` but schema uses `active` |
| Create Room | `POST /api/rooms/create` | ⚠️ | Field name mismatch (`name` vs `title`) |
| Room Join (Socket) | `join_room` event | ✅ | Works |
| Room Leave (Socket) | `leave_room` event | ✅ | Works |
| Mic Toggle (Socket) | `toggle_mic` event | ✅ | Works |
| Claim Seat (Socket) | `claim_seat` event | ✅ | Works |
| Room Chat (Socket) | `send_room_message` event | ✅ | Works, saves to DB |
| Send Reaction (Socket) | `send_reaction` event | ✅ | Works |
| Get Gift List | `GET /api/gifts/list` | ✅ | |
| Send Gift (API) | `POST /api/gifts/send` | ✅ | Commission engine works |
| Send Gift (Socket) | `send_gift` event | ✅ | No commission logic (different from REST) |
| Get Shop Items | `GET /api/shop/items` | ⚠️ | Hardcoded items |
| Purchase Item | `POST /api/shop/purchase` | ⚠️ | Hardcoded price, no inventory |
| Lucky Wheel Rewards | `GET /api/games/lucky-wheel/rewards` | 🔴 | Auth middleware crash |
| Spin Lucky Wheel | `POST /api/games/lucky-wheel/spin` | 🔴 | Auth middleware crash |
| Get My CP | `GET /api/cp/mine` | 🔴 | Auth middleware crash |
| Bind CP | `POST /api/cp/bind` | 🔴 | Auth middleware crash |
| Get My Family | `GET /api/families/mine` | ✅ | |
| Create Family | `POST /api/families/create` | ✅ | |
| Join Family | `POST /api/families/join` | ✅ | |
| My Agency | `GET /api/agency/mine` | ✅ | |
| Apply Agency | `POST /api/agency/apply` | ✅ | |
| Get Wallet | `GET /api/wallet` | 🔴 | Broken import + no auth |
| Recharge | `POST /api/wallet/recharge` | 🔴 | Broken import + no payment verification |
| Withdraw | `POST /api/wallet/withdraw` | 🔴 | Broken import |
| Transactions | `GET /api/wallet/transactions` | 🔴 | Broken import |
| Withdrawal Info | `GET /api/wallet/withdrawal-info` | 🔴 | Broken import |
| Coin Seller Transfer | `POST /api/wallet/seller/transfer` | 🔴 | Broken import |
| PK Request | `POST /api/pk-battles/request` | 🔴 | Auth middleware crash |
| PK Accept | `POST /api/pk-battles/accept` | 🔴 | Auth middleware crash |
| PK End | `POST /api/pk-battles/end` | 🔴 | Auth middleware crash |
| PK Socket Events | `request_pk`, `pk_send_gift` | ✅ | Socket-level PK works |
| Matchmaking Search | `POST /api/matchmaking/search` | 🔴 | Broken import path |
| Matchmaking Stop | `POST /api/matchmaking/stop` | 🔴 | Broken import path |
| Wealth Ranking | (route exists, not mounted) | 🔴 | `rankingRoutes.js` not in `app.js` |
| Charm Ranking | (route exists, not mounted) | 🔴 | `rankingRoutes.js` not in `app.js` |
| Chat History | (route exists, not mounted) | 🔴 | `chatRoutes.js` not in `app.js` + broken model import |
| VIP Plans | (route exists, not mounted) | 🔴 | `vipRoutes.js` not in `app.js` |
| Mission Progress | (controller exists, no route) | 🔴 | `missionController.js` has logic but no route file |
| Frame Shop | (module exists, not mounted) | 🔴 | `modules/shop/shop.routes.js` not in `app.js` |

### 4.2 Flutter Web Panel (Admin/Staff) Routes

| Route | Backend Endpoint | Ready? | Notes |
|-------|-----------------|--------|-------|
| Admin Login | (adminAuthController.login exists) | ⚠️ | **No route mounted** — controller exists but no route file |
| Get All Users | `GET /api/admin/users` | 🔴 | Auth middleware crash |
| Ban/Unban User | `POST /api/admin/users/ban` | 🔴 | Auth middleware crash |
| Staff Login | `POST /api/staff/login` | ✅ | |
| Create Staff | `POST /api/staff/create` | ✅ | |
| Staff List | `GET /api/staff/list` | ✅ | |
| Update Staff | `PUT /api/staff/update/:id` | ✅ | |
| Delete Staff | `DELETE /api/staff/delete/:id` | ✅ | |
| Generate Treasury Coins | `POST /api/treasury/generate` | ✅ | |
| Treasury Logs | `GET /api/treasury/logs` | ✅ | |
| Coin Generate/Deduct | `adminController.generateCoins/deductCoins` | ⚠️ | Controller exists but **no admin routes wire these** |
| Send UID Reward | `adminController.sendReward` | ⚠️ | Controller exists but **no route** |
| System Settings | `adminController.getSettings/updateSettings` | ⚠️ | Controller exists but **no route** |
| Agency Management | `adminController.getAgencies/createAgency` | ⚠️ | Controller exists but **no route** |
| Withdrawal Management | `adminController.getWithdrawals/processWithdrawal` | ⚠️ | Controller exists but **no route** |
| Stats Dashboard | `adminController.getStats` | ⚠️ | Controller exists but **no route** |
| Room Management | `adminController.getAllRooms/closeRoom` | ⚠️ | Controller exists but **no route** |
| User Block/Unblock | `adminController.toggleBlockUser` | ⚠️ | Controller exists but **no route** |
| Agency Hosts | `adminController.getAgencyHosts` | ⚠️ | Controller exists but **no route** |

### 4.3 Summary Scorecard

| Category | Total | ✅ Ready | ⚠️ Partial | 🔴 Broken/Missing |
|----------|-------|---------|-----------|-------------------|
| Mobile App REST Routes | 30 | 12 | 4 | 14 |
| Mobile App Socket Events | 9 | 8 | 0 | 1 (PK end timer) |
| Admin/Staff REST Routes | 18 | 7 | 8 | 3 |
| **Overall** | **57** | **27 (47%)** | **12 (21%)** | **18 (32%)** |

---

## 5. 🔧 Priority Fix Recommendations

### Phase 1 — Startup Blockers (Must Fix Before Server Can Run)

1. **Rename `auth.middleware.js` → `authMiddleware.js`** (or update all 4 imports)
2. **Fix `adminRoutes.js`** — change `adminMiddleware('APP.ADMIN.WEB')` to use `adminMiddleware.verifyStaff`
3. **Fix `wallet.routes.js:3`** — change `require('./wallet.controller')` → `require('../controllers/walletController')`
4. **Fix `matchmakingRoutes.js:4`** — change `require('../../authMiddleware')` → `require('../middlewares/auth.middleware')`
5. **Fix `chatController.js:1`** — change `require('../models/Message')` → `require('../models/RoomMessage')`
6. **Add `node-cron`** to `package.json` dependencies
7. **Add `stripe`** to `package.json` dependencies (or remove stripe code)

### Phase 2 — Schema Alignment

8. **Update `User.js` schema** to include: `coins`, `diamonds`, `arvindId`, `isProfileComplete`, `equippedFrame`, `unlockedFrames`, `ownedFrames`, `familyId`, `familyRole`, `agencyId`, `badges[]`
9. **Update `Room.js` schema** to include: `kickedUsers[]`, `mutedUsers[]`; fix status enum to include `'live'`; or fix controller queries to match existing schema
10. **Unify JWT secret** — use single `JWT_SECRET` env variable everywhere

### Phase 3 — Route Completion

11. **Mount missing routes** in `app.js`: `chatRoutes`, `rankingRoutes`, `vipRoutes`, `shop/module routes`
12. **Create admin routes** for all `adminController.js` functions (coin control, rewards, settings, agencies, withdrawals, stats)
13. **Create admin auth route** for `adminAuthController.login`
14. **Create mission route** for `missionController.js`
15. **Add auth middleware** to all wallet routes
16. **Add sendOtp/verifyOtp routes** to auth routes (controllers exist but have no mounted route)

### Phase 4 — Code Quality

17. **Remove duplicate controllers** — merge `game.controller.js` + `gameController.js`, `adminController.js` + `admin.user.controller.js`
18. **Integrate otp.service.js** into auth.controller.js (currently two separate OTP systems)
19. **Clean up `src/api/` legacy directory** or document its purpose
20. **Apply validation middleware** to route handlers
21. **Replace hardcoded shop items** with database-driven catalog
22. **Add payment verification** to wallet recharge endpoint

---

*End of Report*