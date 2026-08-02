# 🎮 CONTROLLER AUDIT REPORT — ARVIND PARTY BACKEND

**Date:** 2026-07-31
**Scope:** All 90+ controller files in `src/controllers/`
**Method:** Full grep across all controllers for negative coin/diamond patterns, balance validation, mass assignment, response leaks, unsafe req.body/req.params

---

## SCORE: 45 / 100

| Category | Score | Notes |
|---|---|---|
| Mass Assignment | 25/100 | 8 CRITICAL + 15 HIGH (see QUERY_SECURITY_AUDIT_REPORT.md) |
| Business Logic | 50/100 | Balance checks exist but non-atomic; race conditions in gift flows |
| Negative Coins | 60/100 | Most endpoints check balance before $inc; some don't |
| Negative Diamonds | 55/100 | Similar to coins; some endpoints missing checks |
| Wallet Validation | 45/100 | No transactions; two-step updates; no optimistic locking |
| Gift Validation | 40/100 | No gift amount validation; no transaction for sender→receiver |
| Agency Validation | 35/100 | Agency ownership checks scattered; no centralized policy |
| Unsafe req.body | 20/100 | 15+ controllers pass req.body directly to create/update |
| Unsafe req.params | 50/100 | req.params.id used without ObjectId validation in most routes |
| Response Leaks | 55/100 | admin.controller.js uses .select('-password') ✅; but adminAuthController leaks permissions |
| **Overall** | **45/100** | **Balance validation exists but is non-atomic; mass assignment is the biggest risk** |

---

## NEGATIVE COINS/DIAMONDS ANALYSIS

### ✅ Endpoints WITH Balance Validation (Good Practice)

| File | Line | Pattern | Assessment |
|---|---|---|---|
| `appUserController.js` | 36 | `if (user.coins < coins) return 400` | ✅ Pre-check |
| `appUserController.js` | 44 | `{ $inc: { coins: -coins } }` | ✅ Atomic deduction |
| `blindDateController.js` | 154-160 | `{ _id: userA.userId, coins: { $gte: coinCost } }` | ✅ Filter-based check |
| `coinDistributionController.js` | 119 | `Insufficient balance` message | ✅ Transaction-based |
| `coinVaultController.js` | 102, 162 | `Insufficient vault balance` | ✅ Pre-check |
| `dealerController.js` | 179, 428, 810 | `Insufficient dealer wallet balance` | ✅ Pre-check |
| `familyController.js` | 79, 112-117 | `Insufficient coins for family creation` | ✅ Pre-check + atomic |
| `game.controller.js` | 38 | `{ $inc: { coins: -SPIN_COST_COINS } }` | ✅ Fixed cost |
| `gameController.js` | 21-30, 96-105 | `Insufficient coins to play` | ✅ Pre-check + atomic |
| `gift.production.controller.js` | 166, 176 | `Insufficient coins. You need ${totalCost}` | ✅ Pre-check |
| `luckyDrawController.js` | 165, 171, 298, 304 | `Insufficient coins/diamonds` | ✅ Pre-check |
| `room.production.controller.js` | 671-675, 769-773 | `Insufficient coins` | ✅ Pre-check + atomic |
| `roomLockController.js` | 31-40 | `Insufficient coins. Need ${cost}` | ✅ Pre-check + atomic |
| `shop.controller.js` | 29-36 | `Insufficient diamonds` | ✅ Pre-check + atomic |
| `tournamentController.js` | 98 | `Insufficient coins for entry fee` | ✅ Pre-check |
| `vipController.js` | 63 | `Insufficient coins to buy VIP plan` | ✅ Pre-check |
| `vipSystemController.js` | 240, 391 | `Insufficient coins. Need ${cost}` | ✅ Pre-check |
| `walletController.js` | 332-345 | `Insufficient coins/diamonds` | ✅ Pre-check |
| `walletController.js` | 655-660 | `senderBalanceAfter < 0` check | ✅ Post-deduction check |
| `walletController.js` | 723, 741 | `Insufficient diamonds` | ✅ Pre-check |
| `walletController.js` | 786, 820, 830 | `Insufficient diamonds/balance` | ✅ Pre-check |
| `walletController.js` | 986 | `User no longer has sufficient balance` | ✅ Re-check |
| `withdrawalController.js` | 33, 112 | `Insufficient wallet/agency balance` | ✅ Pre-check |
| `webViewGameController.js` | 162 | `Insufficient coins` + leaks balance | 🟠 Leaks balance in response |

### 🔴 Endpoints WITHOUT Balance Validation (Critical)

| File | Line | Pattern | Risk |
|---|---|---|---|
| `bonusController.js` | 147 | `User.findByIdAndUpdate(bonus.userId, { $inc: { coins: -bonus.amount } })` | 🔴 No balance check before deduction — can go negative |
| `walletController.js` | 377 | `User.findByIdAndUpdate(userId, { $inc: { coins: -coins } })` | 🟠 Balance checked at line 342 but non-atomic gap between check and deduction |
| `walletController.js` | 383 | `User.findByIdAndUpdate(userId, { $inc: { diamonds: -diamonds } })` | 🟠 Same non-atomic gap |
| `walletController.js` | 1017 | `$inc: { diamonds: -withdrawal.diamondsRequested }` | 🟠 No pre-check visible at this line |

### 🟠 Race Condition Risk (Non-Atomic Check-Then-Deduct)

The common pattern across most controllers is:
```
1. READ: const user = await User.findById(userId);  // Check balance
2. CHECK: if (user.coins < cost) return 400;         // Validate
3. WRITE: User.findByIdAndUpdate(userId, { $inc: { coins: -cost } });  // Deduct
```

**Risk:** Between step 1 (READ) and step 3 (WRITE), another concurrent request can deduct coins, causing the balance to go negative. The `$inc` operation is atomic at the document level, but the **balance check** is not protected.

**Fix:** Use filter-based atomic deduction:
```js
const updated = await User.findOneAndUpdate(
  { _id: userId, coins: { $gte: cost } },  // Atomic check + deduct
  { $inc: { coins: -cost } },
  { new: true }
);
if (!updated) return res.status(400).json({ message: 'Insufficient coins' });
```

This pattern IS used in `blindDateController.js:154` ✅ but NOT in most other controllers.

---

## MASS ASSIGNMENT SUMMARY (from QUERY_SECURITY_AUDIT_REPORT.md)

### 🔴 CRITICAL: `req.body` → `create()` or `findByIdAndUpdate()`

| File | Line | Code | Risk |
|---|---|---|---|
| `admin.user.controller.js` | 208 | `Gift.create(req.body)` | 🔴 Any field settable |
| `dailyTaskController.js` | 207 | `DailyTask.findByIdAndUpdate(req.params.id, req.body)` | 🔴 Any field settable |
| `luckyDrawController.js` | 257 | `LuckyDraw.findByIdAndUpdate(req.params.id, req.body)` | 🔴 Any field settable |
| `singingController.js` | 32 | `Song.findByIdAndUpdate(req.params.songId, req.body)` | 🔴 Any field settable |
| `eventController.js` | 624, 642, 682, 722 | `create(req.body)` / `findByIdAndUpdate(id, req.body)` | 🔴 4 instances |

### 🟠 HIGH: `const updates = req.body` Pattern

| File | Line | Target | Risk |
|---|---|---|---|
| `admin.controller.js` | 390 | GlobalSetting | 🔴 Any setting key writable |
| `staffController.js` | 217 | Staff | 🔴 Can set `role` to `owner` |
| `walletController.js` | 1463 | WalletConfig | 🔴 Overwrites any config field |
| `moduleManagerController.js` | 90, 217, 338, 458, 539, 895 | Various | 🟠 6 instances |
| `premiumSubscriptionController.js` | 27 | PremiumSubscription | 🟠 |
| `rewardConfigController.js` | 129 | RewardConfig | 🟠 |
| `room.production.controller.js` | 1021 | Room | 🟠 |
| `supportController.js` | 226 | SupportTicket | 🟠 |
| `vipController.js` | 39 | VipPlan | 🟠 |
| `webViewGameController.js` | 101 | WebViewGame | 🟠 |

---

## RESPONSE LEAKS

### 🔴 CRITICAL Response Leaks

| File | Line | Leaked Data | Risk |
|---|---|---|---|
| `authSecure.controller.js` | 253 | `data: { resetToken }` | 🔴 Password reset token in response |
| `authSecure.controller.js` | 61 | `data: { totpSecret, totpQrCode }` | 🟠 TOTP secret in response (expected for 2FA setup, but must be HTTPS) |
| `adminAuthController.js` | 88 | `permissions: staff.permissions` | 🟠 Full permissions object leaked |
| `webViewGameController.js` | 162 | `balance: { coins: currentCoins }` | 🟠 User balance leaked in error response |
| `coinDistributionController.js` | 119 | `Available: ${fromBalance}` | 🟠 Balance amount in error message |
| `dealerController.js` | 179, 428, 810 | `Available: ${balance}` | 🟠 Balance amounts in error messages |
| `roomLockController.js` | 31 | `have ${user.coins \|\| 0}` | 🟠 Coin balance in error message |
| `vipSystemController.js` | 240, 391 | `Need ${cost}` | 🟢 Cost info in error (low risk) |

### ✅ Good Practices

| File | Line | Practice | Assessment |
|---|---|---|---|
| `admin.controller.js` | 144 | `.select('-password')` | ✅ Excludes password from response |
| `authSecure.controller.js` | 139 | `.select('-totpSecret -backupCodes.code')` | ✅ Excludes sensitive 2FA data |
| `walletController.js` | 336 | `.select('coins diamonds familyId uid name')` | ✅ Field selection |
| `walletController.js` | 452 | `.select('agencyId role uid')` | ✅ Field selection |

---

## GIFT VALIDATION

### 🟠 Gift Send Flow Issues

| File | Line | Issue | Risk |
|---|---|---|---|
| `walletController.js` | 649-679 | Non-transactional 3-step flow: READ sender → WRITE sender → WRITE recipient | 🔴 Race condition |
| `walletController.js` | 669-670 | Two separate `$inc` operations without transaction | 🔴 Economy imbalance if one fails |
| `gift.production.controller.js` | 166 | `$inc: { coins: -totalCost }` — no filter-based check | 🟠 Non-atomic |
| `giftSocket.js` | 67, 81, 307 | Socket.IO gift flow — multiple separate updates | 🟠 Non-transactional |
| `giftSocket.js` | 175 | `GiftEvent.findOne({ idempotencyKey })` — idempotency check ✅ | ✅ Good practice |
| `walletController.js` | 641 | `costPerGift = 10` — hardcoded default | 🟡 Should be configurable |

### Gift Validation Missing:
- No gift quantity limit (can send unlimited gifts)
- No gift cooldown/rate limit per user
- No gift value validation (can send negative value gifts if `costPerGift` is manipulated)
- No transaction for sender→recipient transfer

---

## AGENCY VALIDATION

### 🟠 Agency Ownership Issues

| File | Line | Issue | Risk |
|---|---|---|---|
| `agencyController.js` | 14 | `Agency.findOne({ hosts: userId })` — checks if user is a host | ✅ Ownership check |
| `agencyController.js` | 40 | `Agency.findOne({ owner: userId })` — checks if user is owner | ✅ Ownership check |
| `agencyController.js` | 250 | `Agency.findOne({ owner: userId })` — for invitation | ✅ Ownership check |
| `agencyController.js` | 331 | `User.findByIdAndUpdate(request.userId, { agencyId, role: 'host' })` | 🟠 Sets role without permission check on target user |
| `agencyCommissionController.js` | 59 | `const updates = req.body` — mass assignment | 🔴 Can modify commission tiers |
| `agencyTargetController.js` | 77 | `const { targetAmount, endDate, status, ... } = req.body` | ✅ Destructured (whitelist) |
| `walletController.js` | 461 | `Agency.findOne({ owner: req.user.userId })` | ✅ Ownership check |
| `walletController.js` | 520 | `Agency.findById(agencyId)` — no ownership check | 🟠 IDOR — any user can pass any agencyId |

---

## UNSAFE req.params

### 🟠 req.params Used Without ObjectId Validation

| File | Line | Code | Risk |
|---|---|---|---|
| `admin.controller.js` | 118 | `User.findById(req.params.id)` | 🟠 No ObjectId validation |
| `admin.user.controller.js` | 227 | `Gift.findByIdAndUpdate(req.params.id, updateData)` | 🟠 No ObjectId validation |
| `dailyTaskController.js` | 207 | `DailyTask.findByIdAndUpdate(req.params.id, req.body)` | 🔴 No validation + mass assignment |
| `luckyDrawController.js` | 257 | `LuckyDraw.findByIdAndUpdate(req.params.id, req.body)` | 🔴 No validation + mass assignment |
| `singingController.js` | 32 | `Song.findByIdAndUpdate(req.params.songId, req.body)` | 🔴 No validation + mass assignment |
| `walletController.js` | 944, 961 | `Withdrawal.findById(req.params.id)` | 🟠 No ObjectId validation |
| `blindDateController.js` | 180, 195, 223 | `BlindDateSession.findById(req.params.sessionId)` | 🟠 No ObjectId validation |

**Fix:** Apply `validateObjectId('id')` middleware to all `/:id` routes.

---

## BUSINESS LOGIC ISSUES

### 🔴 Critical Business Logic

| File | Line | Issue | Risk |
|---|---|---|---|
| `walletController.js` | 649-679 | Gift send: READ→WRITE→WRITE without transaction | 🔴 Race condition / economy imbalance |
| `walletController.js` | 377-383 | Family contribution: two separate $inc on same document | 🟠 Non-atomic |
| `walletController.js` | 669-670 | Sender and recipient updated in separate calls | 🔴 If one fails, economy is imbalanced |
| `bonusController.js` | 147 | Deducts coins without balance check | 🔴 Can go negative |
| `admin.controller.js` | 261 | `User.findByIdAndUpdate(userId, { $inc })` — admin coin/diamond adjustment | 🟠 No audit log for admin adjustments |
| `rankingController.js` | 244 | `User.updateMany({}, { $set: { coins: 0, diamonds: 0 } })` | 🔴 Resets ALL users' coins/diamonds to zero — dangerous |
| `walletController.js` | 1463 | `{ ...config, ...req.body }` — overwrites wallet config | 🔴 Can change exchange rates, withdrawal limits |

### 🟠 High Business Logic

| File | Line | Issue | Risk |
|---|---|---|---|
| `agencyController.js` | 331 | Sets user role to 'host' without user consent | 🟠 Forced role change |
| `staffController.js` | 217 | `updates = req.body` can set `role` to `owner` | 🔴 Privilege escalation |
| `gift.production.controller.js` | 356-357 | `req.body.comboMultiplier = comboMultiplier; req.body.quantity = 1` — mutates req.body | 🟠 Unusual pattern |
| `walletController.js` | 720 | `diamondsToExchange` — no max limit | 🟠 Can exchange unlimited diamonds |
| `webViewGameController.js` | 201 | `{ sessionId, winAmount }` — win amount from client | 🔴 Client-controlled win amount |

---

## FIX PRIORITY

| Priority | Count | Action |
|---|---|---|
| 🔴 Immediate | 6 | Fix mass assignment (8 create/update with req.body); Add transactions to gift/wallet flows; Fix bonusController negative coins; Fix webViewGame client-controlled winAmount; Fix rankingController reset-all; Fix walletController config overwrite |
| 🟠 High | 5 | Use filter-based atomic deduction everywhere; Add ObjectId validation to all /:id routes; Remove permissions from admin login response; Add gift quantity limits; Add agency ownership checks |
| 🟡 Medium | 4 | Remove balance amounts from error messages; Add audit logging for admin adjustments; Add max exchange limits; Fix req.body mutation in gift controller |
| 🟢 Low | 2 | Document business logic patterns; Add automated tests for negative balance scenarios |