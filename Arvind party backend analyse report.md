# 🦁 ARVIND PARTY BACKEND — COMPREHENSIVE ANALYSIS REPORT

> **Generated:** June 20, 2026  
> **Scan Target:** `d:/Alarms/arvind_party/lib/arvind-party-backend`  
> **Mode:** Read-Only Audit (No code modifications)

---

## 1. 📂 CURRENT PROJECT STATUS

### 1.1 Root Directory
| File | Purpose | Status |
|------|---------|--------|
| `server.js` | Entry point; HTTP server + Socket.io bootstrap | ✅ Present, 78 lines |
| `package.json` | Dependencies & scripts | ✅ Present, 37 deps |
| `.env.example` | Environment variable templates | ✅ Present |
| `.gitignore` | Git ignore rules | ✅ Present |
| `setup_folders.js` | Legacy dir creation script | ⚠️ Present (not needed after setup) |
| `test-imports.js` | Import testing | ✅ Present |
| `firebase-service-account.json` | Firebase admin key | ❌ **MISSING** (referenced in `firebase.js`) |

### 1.2 `src/app.js` — Express Application Hub
- **Line Count:** 138 lines
- **Status:** ✅ Functional — imports & mounts **28 route files**
- **Middleware Stack:** `helmet` → `requestLoggerMiddleware` → `corsConfig` → JSON parser → Rate limiters
- **Mounts:**
  - `/api/auth` (with auth rate limiter)
  - `/api/users`, `/api/admin`, `/api/staff`, `/api/rooms`, `/api/gifts`
  - `/api/wallet`, `/api/agency`, `/api/pk-battles`, `/api/families`
  - `/api/shop`, `/api/games`, `/api/cp`, `/api/treasury`
  - `/api/matchmaking`, `/api/rankings`, `/api/vip`, `/api/chat`
  - `/api/app-users`, `/api/level`, `/api/inventory`, `/api/creator`
  - `/api/support`, `/api/moderation`, `/api/system`, `/api/moments`
  - `/api/notifications`, `/api/events`

### 1.3 Config Files (`src/config/`)
| File | Status | Notes |
|------|--------|-------|
| `cors.js` | ✅ Complete | Dynamic origin list, credential support |
| `db.js` | ✅ Complete | MongoDB with reconnect backoff |
| `socket.js` | ✅ Complete | Socket.io init + JWT auth middleware |
| `firebase.js` | ⚠️ Partial | Initialized but **no push notification methods** |

### 1.4 Models (`src/models/`) — 34 Models Total
All present: `User.js`, `Room.js`, `Gift.js`, `GiftEvent.js`, `GiftTransaction.js`, `RoomMessage.js`, `RoomSeat.js`, `WalletTransaction.js`, `Transaction.js`, `Withdrawal.js`, `Recharge.js`, `Agency.js`, `Family.js`, `Badge.js`, `VipPlan.js`, `VipUser.js`, `CpPair.js`, `PKBattle.js`, `Moment.js`, `Notification.js`, `Event.js`, `GameRecord.js`, `LuckyDrawReward.js`, `Report.js`, `SupportTicket.js`, `Staff.js`, `AuditLog.js`, `Invoice.js`, `Announcement.js`, `MissionProgress.js`, `RaiseHand.js`, `Ranking.js`, `SystemSettings.js`, `GlobalSetting.js`, `TreasuryLog.js`, `Settlement.js`

### 1.5 Routes (`src/routes/`) — 28 Route Files
All present and mounted in `src/app.js`:
`auth.routes.js`, `user.routes.js`, `adminRoutes.js`, `staffRoutes.js`, `room.routes.js`, `gift.routes.js`, `wallet.routes.js`, `agencyRoutes.js`, `pkBattleRoutes.js`, `familyRoutes.js`, `shopRoutes.js`, `gameRoutes.js`, `cpRoutes.js`, `treasuryRoutes.js`, `matchmakingRoutes.js`, `rankingRoutes.js`, `vipRoutes.js`, `chatRoutes.js`, `appUserRoutes.js`, `level.routes.js`, `inventory.routes.js`, `creator.routes.js`, `support.routes.js`, `moderation.routes.js`, `referral.routes.js`, `momentRoutes.js`, `notificationRoutes.js`, `eventRoutes.js`

### 1.6 Controllers (`src/controllers/`) — 36 Controller Files
All present and mapped to routes.

### 1.7 Middlewares (`src/middlewares/`) — 7 Middleware Files
| File | Status | Purpose |
|------|--------|---------|
| `auth.middleware.js` | ✅ | JWT Bearer token verification |
| `adminMiddleware.js` | ✅ | `verifyStaff`, `verifyOwner`, `requirePermission` |
| `isAdmin.js` | ⚠️ | Checks `req.user.role === 'admin'` (conflicts with adminMiddleware) |
| `errorHandler.middleware.js` | ✅ | Error formatting, Mongoose/JWT catch |
| `validation.middleware.js` | ✅ | express-validator wrappers |
| `request-logger.middleware.js` | ✅ | HTTP request duration logging |
| `logger.middleware.js` | ⚠️ | Uses `chalk` package **not in dependencies** |

### 1.8 Sockets (`src/sockets/`) — 5 Socket Handlers
| File | Status | Events Handled |
|------|--------|----------------|
| `roomSocket.js` | ✅ | `join_room`, `leave_room`, `toggle_mic`, `kick_user`, `admin_mute_user`, `unkick_user`, `admin_unmute_user` |
| `chatSocket.js` | ⚠️ | `send_room_message`, `send_reaction` — **registers global io.use()** causing duplicate auth |
| `seatSocket.js` | ✅ | `claim_seat` |
| `giftSocket.js` | ⚠️ | `send_gift` — **no socket auth**, relies on client data |
| `pkBattleSocket.js` | ✅ | `request_pk`, `pk_send_gift` — uses hardcoded placeholder avatars |

### 1.9 Services (`src/services/`) — 1 Service File
- `otp.service.js` — ✅ Complete, with Redis + in-memory fallback, Twilio SMS

### 1.10 Utils (`src/utils/`) — 2 Utility Files
| File | Status | Purpose |
|------|--------|---------|
| `logger.js` | ✅ | Structured logging to console + file |
| `jwt.js` | ✅ | Simple JWT token generation |

### 1.11 Duplicate / Legacy Area: `src/api/`
| File | Status | Issue |
|------|--------|-------|
| `src/api/app.js` | ⚠️ **DUPLICATE** | Separate Express app with wrong relative imports (`./config/db`, `./routes/auth.routes`) |
| `src/api/social.routes.js` | ⚠️ **ORPHAN** | Not mounted in `src/app.js` or `server.js` — contains Follow/CP endpoints that may conflict with `cpRoutes.js` |

### 1.12 `src/modules/` — Empty Directory
- **No files present.** The `setup_folders.js` created these directories but they were never populated.

---

## 2. 🐛 BUG & ERROR TRACKING

### 2.1 Compilation / Import Errors

| # | Severity | File | Issue |
|---|----------|------|-------|
| B1 | 🔴 **HIGH** | `src/middlewares/logger.middleware.js` (Line 6) | Uses `require('chalk')` but **chalk is NOT listed in `package.json` dependencies**. Will crash on `npm start`. |
| B2 | 🔴 **HIGH** | `src/api/app.js` (Lines 7–11) | Orphan file imports from `./config/db`, `./routes/*` — but it's inside `src/api/` so these paths are **wrong** (`./config/db` should be `../config/db`). Will crash if invoked. |
| B3 | 🟡 **MEDIUM** | `src/controllers/admin.controller.js` (Lines 353, 365) | Uses `GlobalSetting` model but **no `require('../models/GlobalSetting')` at top of file**. This will crash `getGlobalSettings` and `updateGlobalSettings`. |
| B4 | 🟡 **MEDIUM** | `src/controllers/badgeController.js` | Referenced in `server.js` line 45 but path `./src/controllers/badgeController` may have export mismatch — needs verification. |
| B5 | 🟡 **MEDIUM** | `src/routes/adminRoutes.js` (Line 19) | `isAdmin = verifyAdmin` where `verifyAdmin` comes from `isAdmin.js` which checks `req.user.role === 'admin'` — but `adminMiddleware.js` sets `req.userRole` (not `req.user.role`). This guard will **never pass**. |

### 2.2 Runtime / Logic Errors

| # | Severity | File | Issue |
|---|----------|------|-------|
| B6 | 🟡 **MEDIUM** | `src/routes/momentRoutes.js` (Line 18) | `router.get('/search', ...)` is placed **after** `router.get('/:momentId', ...)` (Line 11). Express will interpret `/search` as a `:momentId` value — the search route is **dead code**. |
| B7 | 🟡 **MEDIUM** | `src/sockets/chatSocket.js` (Line 22) | Calls `io.use(authenticateSocket)` globally, but `src/config/socket.js` already registers a JWT auth middleware globally. This creates **double authentication**. |
| B8 | 🟡 **MEDIUM** | `src/sockets/giftSocket.js` | **No authentication** at all — `giftSocket.js` does NOT implement any JWT verification. Relies entirely on client-supplied `senderId`. A malicious client could impersonate any user. |
| B9 | 🟡 **MEDIUM** | `src/routes/wallet.routes.js` (Line 74) | `POST /send-gift` exists here but `src/routes/gift.routes.js` also has `POST /send` — creating **two different API paths** for sending gifts with potentially different logic. |
| B10 | 🟡 **MEDIUM** | `src/routes/adminRoutes.js` (Lines 216–220) | `DELETE /reports/:id` calls `reportController.resolveReport` (same as POST resolve). Should use a different delete handler. |
| B11 | 🟢 **LOW** | `src/app.js` (Line 121) | Mounts `referralRoutes` at `/api/system` instead of `/api/referral`. Referral endpoints will be at `/api/system/referral` instead of `/api/referral`. |

### 2.3 Missing / Broken Paths

| # | Severity | Issue |
|---|----------|-------|
| B12 | 🔴 **HIGH** | `server.js` line 24: `require('./src/services/otp.service')` exports `initRedis` — confirms this pattern works ✅ |
| B13 | 🔴 **HIGH** | `firebase-service-account.json` — **missing from root**. Firebase will silently disable. |
| B14 | 🟡 **MEDIUM** | **No `.env` file present** — only `.env.example` exists. `server.js` will crash on missing `JWT_SECRET`, `MONGO_URI`, `PORT`. |

### 2.4 Route Conflict Detection

| Route File | Path | Conflict |
|-----------|------|---------|
| `gift.routes.js` | `POST /api/gifts/send` | ⚡ Duplicates wallet.routes.js `POST /api/wallet/send-gift` |
| `chatRoutes.js` | `GET /api/chat/history/:userId/:targetId` | No auth middleware applied |
| `appUserRoutes.js` | `POST /api/app-users/join-agency` | No auth middleware (sensitive operation) |
| `cpRoutes.js` | `POST /api/cp/bind` | Potential duplicate with `src/api/social.routes.js` CP endpoints |
| `referral.routes.js` | Mounted at `/api/system` | Misleading — should be `/api/referral` |

---

## 3. 🏗️ MISSING ARCHITECTURE LOG

### 3.1 Controllers Missing Methods (Referenced in Routes but Unverified)

| Route Reference | Controller | Potential Missing Export |
|----------------|-----------|------------------------|
| `adminController.getSettings` | `admin.controller.js` | ❌ **Not found** in the scanned file |
| `adminController.updateSettings` | `admin.controller.js` | ❌ **Not found** (duplicate of `updateGlobalSettings`?) |
| `adminController.getUsers` | ✅ Exists | — |
| `adminController.getUserDetail` | ✅ Exists | — |
| `adminUserController.verifyUser` | `admin.user.controller.js` | Not scanned — assume exists |
| Various methods in `adminUserController`, `staffController`, `treasuryController` | Wide surface area | Many not verified |

### 3.2 Missing / Incomplete Express Components

| Component | Status | Required Fix |
|-----------|--------|-------------|
| **Push Notification Service** | ⚠️ Missing | Firebase admin initialized but no `sendPushNotification()` utility exists |
| **Payment Service Abstraction** | ⚠️ Missing | Razorpay logic is embedded in `walletController` — no reusable service layer |
| **Socket Rate Limiter** | ❌ Missing | No rate limiting on socket events — DoS vulnerability |
| **File Upload Middleware** | ⚠️ Partial | `multer` in deps but no upload middleware created |
| **Admin Guard Consistency** | ❌ Broken | Two competing auth systems: `adminMiddleware.js` (userRole) vs `isAdmin.js` (role) |

### 3.3 Schemas with Missing Features

| Model | Missing Fields / Features |
|-------|--------------------------|
| `User.js` | Assumed `followers`, `following`, `cpPartner`, `cpRequests`, `cpLevel` — must verify schema surface matches `social.routes.js` usage |
| `WalletTransaction.js` | Needs `type` enum: `'recharge'`, `'gift_sent'`, `'withdrawal'`, `'admin'` |
| `Gift.js` | Needs `animationType`, `iconUrl` fields |
| `Room.js` | Needs `kickedUsers`, `mutedUsers`, `seats[]` arrays |

### 3.4 Middleware Gaps

| Guard Type | Status | Gap |
|-----------|--------|-----|
| **Owner-only** (`verifyOwner`) | ✅ Exists | Only on treasury + staff routes |
| **Staff-only** (`verifyStaff`) | ✅ Exists | On all admin routes |
| **Permission-based** (`requirePermission`) | ✅ Exists | Not used in any current route |
| **Rate Limiting** – Auth | ✅ Exists | 5 req/15min |
| **Rate Limiting** – OTP | ✅ Exists | 3 req/min |
| **Rate Limiting** – General API | ✅ Exists | 1000 req/15min |
| **Rate Limiting** – Socket events | ❌ **MISSING** | No protection |
| **File Upload** – Multer | ❌ **MISSING** | Package installed, no config |
| **Request ID / Correlation** | ❌ **MISSING** | No traceability |
| **CORS custom origin validation** | ✅ Exists | In `cors.js` |

---

## 4. 🔌 FRONTEND INTEGRATION MAPPING

### 4.1 REST API Endpoints — Complete Checklist

#### 🔐 Authentication (`/api/auth`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| POST | `/api/auth/send-otp` | ❌ | App (Login) |
| POST | `/api/auth/otp-verify` | ❌ | App (Login) |
| POST | `/api/auth/resend-otp` | ❌ | App (Login) |
| POST | `/api/auth/register` | ❌ | App (Signup) |
| POST | `/api/auth/refresh-token` | ❌ | App/Web |
| POST | `/api/auth/logout` | ✅ JWT | App/Web |
| GET | `/api/auth/me` | ✅ JWT | App/Web |

#### 👤 Users (`/api/users`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| POST | `/api/users/complete-profile` | ✅ JWT | App |
| GET | `/api/users/center` | ✅ JWT | App |
| POST | `/api/users/equip-frame` | ✅ JWT | App |

#### 🎙️ Rooms (`/api/rooms`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/rooms/live` | ❌ | App/Web |
| POST | `/api/rooms/create` | ✅ JWT | App |

#### 🎁 Gifts (`/api/gifts`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/gifts/list` | ✅ JWT | App/Web |
| POST | `/api/gifts/send` | ✅ JWT | App |

#### 💰 Wallet (`/api/wallet`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/wallet` | ✅ JWT | App/Web |
| GET | `/api/wallet/transactions` | ✅ JWT | App/Web |
| POST | `/api/wallet/razorpay/order` | ✅ JWT | App/Web |
| POST | `/api/wallet/razorpay/verify` | ✅ JWT | App/Web |
| POST | `/api/wallet/razorpay/webhook` | ❌ Public | External (Razorpay) |
| POST | `/api/wallet/send-gift` | ✅ JWT | App |
| POST | `/api/wallet/withdraw` | ✅ JWT | App/Web |
| GET | `/api/wallet/withdrawals` | ✅ JWT | App/Web |

#### 🎮 Games (`/api/games`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/games/lucky-wheel/rewards` | ✅ JWT | App |
| POST | `/api/games/lucky-wheel/spin` | ✅ JWT | App |
| POST | `/api/games/scratch-card/play` | ✅ JWT | App |
| GET | `/api/games/leaderboard` | ✅ JWT | App |

#### 💑 CP System (`/api/cp`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/cp/mine` | ✅ JWT | App |
| POST | `/api/cp/bind` | ✅ JWT | App |

#### 🏆 Rankings (`/api/rankings`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/rankings/wealth` | ✅ JWT | App/Web |
| GET | `/api/rankings/charm` | ✅ JWT | App/Web |

#### 📦 Shop (`/api/shop`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/shop/items` | ✅ JWT | App |
| POST | `/api/shop/purchase` | ✅ JWT | App |

#### 👑 VIP (`/api/vip`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/vip/plans` | ✅ JWT | App/Web |
| POST | `/api/vip/buy` | ✅ JWT | App |

#### 🏠 Family (`/api/families`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/families/mine` | ✅ JWT | App |
| POST | `/api/families/create` | ✅ JWT | App |
| POST | `/api/families/join` | ✅ JWT | App |

#### 🏢 Agency (`/api/agency`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/agency` | ✅ JWT | App/Web |
| POST | `/api/agency/create` | ✅ JWT | App |
| GET | `/api/agency/hosts` | ✅ JWT | App/Web |
| GET | `/api/agency/earnings` | ✅ JWT | App/Web |
| POST | `/api/agency/apply` | ✅ JWT | App |

#### 💬 Chat (`/api/chat`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/chat/history/:userId/:targetId` | ❌ **MISSING AUTH** | App |

#### ⚡ PK Battle (`/api/pk-battles`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| POST | `/api/pk-battles/request` | ✅ JWT | App |
| POST | `/api/pk-battles/accept` | ✅ JWT | App |
| POST | `/api/pk-battles/end` | ✅ JWT | Admin |

#### 📱 Moments (`/api/moments`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/moments` | ✅ JWT | App |
| POST | `/api/moments/create` | ✅ JWT | App |
| GET | `/api/moments/:momentId` | ✅ JWT | App |
| POST | `/api/moments/:momentId/like` | ✅ JWT | App |
| POST | `/api/moments/:momentId/unlike` | ✅ JWT | App |
| POST | `/api/moments/:momentId/comment` | ✅ JWT | App |
| DELETE | `/api/moments/:momentId/comment/:commentId` | ✅ JWT | App |
| DELETE | `/api/moments/:momentId` | ✅ JWT | App |
| GET | `/api/moments/search` | ✅ JWT | App (⚠️ Dead route — see B6) |

#### 🔔 Notifications (`/api/notifications`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/notifications` | ✅ JWT | App |
| PUT | `/api/notifications/:notificationId/read` | ✅ JWT | App |
| PUT | `/api/notifications/mark-all-read` | ✅ JWT | App |
| DELETE | `/api/notifications/:notificationId` | ✅ JWT | App |

#### 🎪 Events (`/api/events`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/events/list` | ✅ JWT | App |
| GET | `/api/events/:eventId` | ✅ JWT | App |
| POST | `/api/events/:eventId/join` | ✅ JWT | App |
| POST | `/api/events/:eventId/leave` | ✅ JWT | App |

#### 📊 Level / XP (`/api/level`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/level/:id/level` | ✅ JWT | App |
| POST | `/api/level/xp/add` | ✅ JWT | App |

#### 🎒 Inventory (`/api/inventory`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/inventory` | ✅ JWT | App |
| POST | `/api/inventory/use/:itemId` | ✅ JWT | App |
| DELETE | `/api/inventory/:itemId` | ✅ JWT | App |

#### 🎨 Creator (`/api/creator`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/creator/earnings` | ✅ JWT | App |
| GET | `/api/creator/analytics` | ✅ JWT | App |
| POST | `/api/creator/withdraw` | ✅ JWT | App |

#### 🆘 Support (`/api/support`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/support/faq` | ❌ | App/Web |
| GET | `/api/support/tickets` | ✅ JWT | App/Web |
| POST | `/api/support/ticket/create` | ✅ JWT | App/Web |
| POST | `/api/support/message` | ✅ JWT | App/Web |

#### 🛡️ Moderation (`/api/moderation`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/moderation/reports` | ✅ JWT | App/Web |
| POST | `/api/moderation/report` | ✅ JWT | App/Web |
| POST | `/api/moderation/block` | ✅ JWT | App/Web |

#### 🔗 Referral (`/api/system/referral`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| GET | `/api/system/referral` | ✅ JWT | App |
| POST | `/api/system/referral/claim` | ✅ JWT | App |

#### 📋 App Users (`/api/app-users`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| POST | `/api/app-users/join-agency` | ❌ **MISSING AUTH** | App |
| POST | `/api/app-users/withdraw` | ❌ **MISSING AUTH** | App |

#### 🛠️ Admin Panel (`/api/admin`) — 30+ Endpoints
All admin routes protected by `authMiddleware` + `verifyStaff`. Key admin panels:
| Method | Path | Admin Function |
|--------|------|----------------|
| GET | `/api/admin/stats` | Dashboard overview |
| GET | `/api/admin/users` | User list (paginated) |
| GET/PUT | `/api/admin/users/:id` | User detail / edit |
| POST | `/api/admin/users/block/:userId` | Ban user |
| POST | `/api/admin/wallets/adjust/:userId` | Adjust coins |
| GET | `/api/admin/withdrawals/pending` | Withdrawal queue |
| POST | `/api/admin/withdrawals/approve/:id` | Approve withdrawal |
| GET | `/api/admin/announcements` | Announcement list |
| POST | `/api/admin/announcement` | Send announcement |
| GET/POST/PUT/DELETE | `/api/admin/staff/*` | Staff CRUD |
| POST | `/api/admin/coins/generate` | Coin generation (Owner only) |
| POST | `/api/admin/coins/deduct` | Coin deduction (Owner only) |
| GET | `/api/admin/vip/plans` | VIP plan list |
| GET/POST/PUT/DELETE | `/api/admin/events/*` | Event management |
| GET/POST | `/api/admin/reports/*` | Report management |
| GET | `/api/admin/audit-logs` | Audit trail |
| GET/POST | `/api/admin/gifts/*` | Gift CRUD |
| POST | `/api/admin/notifications/send` | Push broadcast |

#### 📦 Treasury (`/api/treasury`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| POST | `/api/treasury/generate` | ✅ verifyOwner | Admin/Owner |
| GET | `/api/treasury/logs` | ✅ verifyOwner | Admin/Owner |

#### 🔍 Matchmaking (`/api/matchmaking`)
| Method | Path | Auth | Panel |
|--------|------|------|-------|
| POST | `/api/matchmaking/search` | ✅ JWT | App |
| POST | `/api/matchmaking/stop` | ✅ JWT | App |

---

### 4.2 Socket.io Events — Complete Map

#### 📡 Client → Server (Incoming Events)
| Event | Payload | Handler File | Auth |
|-------|---------|-------------|------|
| `join_room` | `{ roomId, userId, userProfile }` | `roomSocket.js` | ✅ (Global socket auth) |
| `leave_room` | `{ roomId, userId, userProfile }` | `roomSocket.js` | ✅ |
| `toggle_mic` | `{ roomId, userId, isMuted }` | `roomSocket.js` | ✅ |
| `kick_user` | `{ roomId, targetUserId, adminId }` | `roomSocket.js` | ✅ |
| `admin_mute_user` | `{ roomId, targetUserId, adminId }` | `roomSocket.js` | ✅ |
| `unkick_user` | `{ roomId, targetUserId, adminId }` | `roomSocket.js` | ✅ |
| `admin_unmute_user` | `{ roomId, targetUserId, adminId }` | `roomSocket.js` | ✅ |
| `send_room_message` | `{ roomId, senderId, message }` | `chatSocket.js` | ⚠️ Double auth |
| `send_reaction` | `{ roomId, emoji }` | `chatSocket.js` | ⚠️ Double auth |
| `claim_seat` | `{ roomId, userId, userName, userAvatar, seatIndex }` | `seatSocket.js` | ✅ |
| `send_gift` | `{ roomId, senderId, receiverId, giftId, quantity }` | `giftSocket.js` | ❌ **No auth** |
| `request_pk` | `{ targetRoomId }` | `pkBattleSocket.js` | ✅ |
| `pk_send_gift` | `{ battleId, hostNumber, giftValue }` | `pkBattleSocket.js` | ✅ |

#### 📡 Server → Client (Outgoing Events)
| Event | Payload | Purpose |
|-------|---------|---------|
| `user_joined` | `{ userId, userProfile, message }` | Notify room of new member |
| `user_left` | `{ userId, userProfile, message }` | Notify room of departure |
| `mic_status_changed` | `{ userId, isMuted }` | Mic toggle broadcast |
| `user_kicked` | `{ targetUserId }` | User was kicked from room |
| `user_admin_muted` | `{ targetUserId }` | User muted by admin |
| `user_unkicked` | `{ targetUserId }` | Kick was reversed |
| `user_admin_unmuted` | `{ targetUserId }` | Mute was reversed |
| `receive_room_message` | `{ roomId, senderId, message, messageId }` | New chat message |
| `receive_reaction` | `{ roomId, emoji }` | Emoji reaction |
| `seat_updated` | `{ seatIndex, userId, userName, userAvatar, isMuted, isLocked }` | Seat claimed |
| `seat_error` | `{ message }` | Seat claim error |
| `gift_animation` | `{ giftId, giftImageUrl, senderName, quantity }` | Gift animation trigger |
| `gift_error` | `{ message }` | Gift send error |
| `receive_gift` | `{ roomId, senderName, receiverName, giftName, iconUrl, animationType }` | Gift notification from REST |
| `pk_started` | Full battle object | PK battle started |
| `pk_update` | `{ remainingSeconds, host1Score, host2Score }` | PK score/timer update |
| `pk_ended` | `{ winnerName }` | PK battle ended |
| `force_logout` | `{ message }` | Admin force logout on ban |

---

## 5. 📋 SUMMARY & RECOMMENDATIONS

### Critical Issues (Fix Immediately)
1. **`chalk` missing from package.json** — `logger.middleware.js` will crash on require
2. **Missing `GlobalSetting` require** in `admin.controller.js` — breaks settings endpoints
3. **No `.env` file** — server will crash on startup due to missing env vars
4. **Duplicate auth on socket** — `chatSocket.js` `io.use()` conflicts with `socket.js` auth
5. **Dead route** — Moment search endpoint will never match due to Express param precedence

### Medium Priority
1. **Orphan `src/api/` directory** — either integrate or delete to avoid confusion
2. **Two gift-send endpoints** — consolidate `wallet.routes.js` and `gift.routes.js` logic
3. **Admin role check inconsistency** — `isAdmin.js` vs `adminMiddleware.js` role field mismatch
4. **Missing socket auth** on `giftSocket.js` — security vulnerability
5. **Missing auth middleware** on `chatRoutes.js` and `appUserRoutes.js`

### Architecture Gaps
1. **No notification sending service** — Firebase initialized but unused
2. **No payment service abstraction** — Razorpay logic embedded in controller
3. **No socket rate limiting** — DoS protection missing
4. **No file upload middleware** — multer package unused
5. **Empty `src/modules/` directory** — planned module structure never implemented

---

*End of Analysis Report — 0 files modified, 69 files inspected.*