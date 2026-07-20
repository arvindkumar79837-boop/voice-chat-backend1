# BACKEND_ECONOMY_REPORT.md — Coin Economy + Agency Targets + Event Manager + Games

---

## 1. Event Manager Role — VERIFIED

**Staff.js** `event_manager` role:
- Level: 65
- Department: `events`
- Managed Module: `events`
- DEFAULT_PERMISSIONS: `['event.create', 'event.edit', 'event.delete', 'event.view']`

✅ **Status**: Role is fully defined. Owner can assign via `POST /api/staff/create` with `role: 'event_manager'`. No restrictions. Permissions include full CRUD + view for events.

---

## 2. Coin Recharge Pricing System — NEW

### New Files:
| File | Purpose |
|------|---------|
| `src/models/RechargePlan.js` | Price tier model (₹100=10000 coins, etc.) |
| `src/controllers/rechargePlanController.js` | CRUD for plans |
| `src/routes/rechargePlanRoutes.js` | Routes |

### API Endpoints:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/recharge-plans` | **Public** | Active plans (mobile app display) |
| `GET` | `/api/recharge-plans/admin/all` | `verifyOwner` | All plans (admin panel) |
| `POST` | `/api/recharge-plans/admin/create` | `verifyOwner` | Create plan |
| `PUT` | `/api/recharge-plans/admin/:id` | `verifyOwner` | Update plan |
| `DELETE` | `/api/recharge-plans/admin/:id` | `verifyOwner` | Delete plan |

### RechargePlan Schema:
```js
{
  priceINR: Number,        // 100, 200, 500
  coinsAwarded: Number,    // Owner adjustable: ₹100 = 10000 coins
  isActive: Boolean,       // Toggle without deleting
  displayOrder: Number,    // Sort order on mobile
  label: String,           // "Best Value", "Popular"
  tagColor: String,        // Display color
  createdBy: ObjectId,     // Staff reference
}
```

### Razorpay Integration:
- `createRazorpayOrder` now looks up `RechargePlan` by `packageId` first
- Falls back to plan matching `priceINR` if no packageId
- `verifyPayment` uses stored `packageId` to fetch the coins awarded
- **Rate changes by Owner affect only NEW transactions, old ones use snapshot**

---

## 3. Coin Distribution Hierarchy — NEW

### Hierarchy (top → bottom):
```
Owner (level 4)
  └→ Merchant (level 3)
       └→ Super Coin Seller (level 2)
            └→ Normal Coin Seller (level 1)
                 └→ End User (level 0)
```

### New Files:
| File | Purpose |
|------|---------|
| `src/controllers/coinDistributionController.js` | Generate-for-user + hierarchy distribution |
| `src/routes/coinDistributionRoutes.js` | Routes |

### API Endpoints:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/admin/wallet/generate-for-user` | `verifyOwner` | Owner credits coins to ANY user directly |
| `POST` | `/api/admin/wallet/distribute` | `verifyOwner` | Owner distributes down the hierarchy |

### Validation Rules:
- Transfers ONLY allowed downward: Owner→Merchant, Merchant→Super, Super→Normal, Normal→User
- Cross-level blocked: Normal→User ✅, Normal→Merchant ❌, User→Seller ❌
- Each transfer creates paired `WalletTransaction` records (debit + credit) with shared `txHash`
- Full audit trail via `AuditLog` with `COIN_DISTRIBUTION` and `COIN_GENERATE_FOR_USER` actions

---

## 4. Agency Target System — NEW

### New Files:
| File | Purpose |
|------|---------|
| `src/models/AgencyTarget.js` | Target model with progress tracking |
| `src/controllers/agencyTargetController.js` | CRUD + progress + auto-expiry |
| `src/routes/agencyTargetRoutes.js` | Routes |

### API Endpoints:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/admin/agency-targets` | `verifyOwner` | Create target |
| `GET` | `/api/admin/agency-targets` | `verifyOwner` | List targets (filter by status/agency) |
| `PUT` | `/api/admin/agency-targets/:id` | `verifyOwner` | Edit/extend target |
| `GET` | `/api/admin/agency-targets/:agencyId/dashboard` | `verifyOwner` | Agency progress dashboard |

### AgencyTarget Schema:
```js
{
  agencyId: ObjectId,          // ref Agency
  targetType: 'COINS_SPENT' | 'REVENUE_USD',
  targetAmount: Number,
  durationType: 'CUSTOM_DAYS' | 'WEEKLY' | 'MONTHLY',
  durationDays: Number,
  startDate: Date,
  endDate: Date,               // Auto-calculated
  currentProgress: Number,     // Auto-updated on gift spending
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'EXPIRED',
  rewardType: 'coins' | 'frame' | 'badge' | 'custom',
  rewardValue: Mixed,
  rewardClaimed: Boolean,
  createdBy: ObjectId,         // Staff
}
```

### Auto-Progress Tracking:
- When agency members receive gifts, `currentProgress` increments automatically
- Hook added to `gift.production.controller.js` → `agencyTargetController.updateProgress()`
- Cron job runs every 6 hours to auto-expire targets → status changes to `COMPLETED`/`FAILED`

### Dashboard Data:
- Active target with % complete + days remaining
- Past 10 targets with completion stats
- Agency summary (total/completed/failed counts)

---

## 5. WebView Games — VERIFIED (FIXED)

### Issue Found & Fixed:
- `webViewGameRoutes` was imported in `app.js` but **NEVER MOUNTED** — all WebView game APIs were dead
- **FIXED**: Added `app.use('/api/games', webViewGameRoutes)` to `app.js`

### Current Game Endpoints (all behind `authMiddleware`):

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/games/games/active` | auth | Active games for mobile app |
| `GET` | `/api/games/games/:gameId` | auth | Single game detail |
| `POST` | `/api/games/games` | auth+isAdmin | Create game (Owner) |
| `PUT` | `/api/games/games/:gameId` | auth+isAdmin | Update game (Owner) |
| `DELETE` | `/api/games/games/:gameId` | auth+isAdmin | Delete game (Owner) |
| `POST` | `/api/games/games/start-session` | auth | Start game session |
| `POST` | `/api/games/games/end-session` | auth | End game session |

### Note:
> Rented ya khud-banaya game dono `IN_HOUSE`/`RENTED` gameType ke through same tarike se chalenge, jab tak gameUrl HTTPS pe hai aur provider ne X-Frame/embedding block nahi kiya — rented game provider se ye clause confirm kar lena.

---

## 6. Summary of All New/Modified Files

### New Files (6):
| File | Purpose |
|------|---------|
| `src/models/RechargePlan.js` | Coin pricing tiers |
| `src/controllers/rechargePlanController.js` | Plan CRUD |
| `src/routes/rechargePlanRoutes.js` | Plan routes |
| `src/models/AgencyTarget.js` | Agency target tracking |
| `src/controllers/agencyTargetController.js` | Target CRUD + auto-progress |
| `src/routes/agencyTargetRoutes.js` | Target routes |
| `src/controllers/coinDistributionController.js` | Hierarchy coin distribution |
| `src/routes/coinDistributionRoutes.js` | Distribution routes |

### Modified Files (5):
| File | Change |
|------|--------|
| `src/controllers/walletController.js` | RechargePlan pricing in createOrder + verifyPayment |
| `src/controllers/gift.production.controller.js` | Agency target progress hook |
| `src/app.js` | Mounted recharge-plans, agency-targets, coin-distribution, webViewGameRoutes |
| `server.js` | Agency target expiry cron (every 6 hours) |
| `src/models/Staff.js` | event_manager role VERIFIED (no change needed) |

---

## 7. Coin Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    COIN ECONOMY FLOW                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  USER RECHARGE (Razorpay)                                    │
│  User pays ₹ → RechargePlan.priceINR → Plan.coinsAwarded    │
│  → coins credited to user wallet                             │
│                                                              │
│  OWNER MINTING (CoinVault)                                   │
│  Vault → mint → dispatch to seller → seller wallet           │
│  Vault → burn (destroy coins)                                │
│                                                              │
│  OWNER DIRECT (NEW)                                          │
│  /generate-for-user → coins directly to user wallet          │
│                                                              │
│  HIERARCHY DISTRIBUTION (NEW)                                │
│  Owner → Merchant → Super Seller → Normal Seller → User      │
│  (downward only, validated by role level)                    │
│                                                              │
│  SELLER TO USER (existing)                                   │
│  Seller wallet balance → transfer → user wallet              │
│                                                              │
│  GIFT FLOW (existing + agency target hook)                   │
│  Sender coins → GiftEvent → Receiver coins                   │
│  If receiver in agency → agency commission + target progress │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```
