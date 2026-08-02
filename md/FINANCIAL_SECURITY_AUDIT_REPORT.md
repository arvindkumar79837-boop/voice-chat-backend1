# Financial Security Audit Report — Arvind Party Backend

**Date**: 2025-07-31  
**Scope**: Wallet, Coins, Diamonds, Salary, Withdrawal, Recharge, Gift, Agency, Host Earnings  
**Total Files Audited**: 25+ controllers, services, and models  
**Currency Types**: Coins (in-app), Diamonds (premium), INR (fiat)

---

## Executive Summary

The financial layer demonstrates **strong atomic operation patterns** in high-value flows (gifts, withdrawals, dealer transfers, salary) using MongoDB sessions and `findOneAndUpdate` with `$inc`. However, **critical gaps exist** in non-atomic balance updates, missing negative-balance guards, replay-attack vectors, and fraud-detection blind spots. The coin vault pattern is sound, but withdrawal and recharge flows need hardening.

| Category | Status |
|---|---|
| Negative Balance | 🟡 Partial guards; several non-atomic paths can drift negative |
| Double Spend | 🟢 Mostly prevented via atomic ops; one gap in game sessions |
| Race Condition | 🟡 Several read-modify-write patterns without transactions |
| Atomic Updates | 🟢 ~70% of financial writes use atomic operations |
| Fraud | 🟡 Replay protection exists for IAP; missing for other flows |

---

## Files Audited

| File | Lines | Purpose |
|---|---|---|
| `src/controllers/diamondEconomyController.js` | 135 | Google Play recharge, gift→diamond conversion, wallet balance |
| `src/controllers/withdrawalController.js` | 181 | Agency withdrawal request/approve/reject |
| `src/controllers/dealerController.js` | 864 | Dealer wallet CRUD, coin transfers, refunds, vault credit |
| `src/controllers/appUserController.js` | 56 | User withdrawal request, agency join |
| `src/controllers/gameController.js` | 247 | Lucky wheel, scratch card, weekly champion |
| `src/controllers/game.controller.js` | 81 | Lucky wheel spin (different from gameController) |
| `src/controllers/webViewGameController.js` | 336 | Webview game sessions, start/end, ledger |
| `src/controllers/familyController.js` | 2232 | Family creation (coin cost), stay rewards, shop, PK, wars |
| `src/controllers/dailyTaskController.js` | 293 | Daily task progress, reward claims |
| `src/controllers/salaryController.js` | 264 | Monthly host salary calculation and payment |
| `src/controllers/agencyController.js` | 404 | Agency CRUD, host management, earnings |
| `src/controllers/attendanceController.js` | 228 | Host attendance start/end, live/monthly reports |
| `src/controllers/creatorController.js` | 43 | Creator earnings and analytics |
| `src/workers/giftQueueWorker.js` | 352 | BullMQ gift processing, bulk gifts |
| `src/services/schedulerService.js` | 146 | Target audit, auto-settlement of diamond exchanges |
| `src/models/User.js` | 181 | User schema with coins, diamonds, family, agency refs |
| `src/models/WalletTransaction.js` | 74 | Wallet transaction ledger |
| `src/models/Withdrawal.js` | 64 | User withdrawal requests with KYC |
| `src/models/AgencyWallet.js` | 14 | Agency commission wallet |
| `src/models/DealerWallet.js` | 48 | Dealer/coin-seller wallet with limits |
| `src/models/SalaryRecord.js` | 27 | Monthly salary records |
| `src/models/GiftTransaction.js` | 33 | Gift transaction ledger |
| `src/models/CoinVault.js` | 58 | Global coin vault (owner minting) |
| `src/sockets/giftSocket.js` | 568 | Socket gift sending with atomic ops |
| `src/sockets/index.js` | 117 | Global socket init |

---

## Detailed Findings

### 1. Negative Balance

| Severity | Location | Description |
|---|---|---|
| 🟡 MEDIUM | `diamondEconomyController.js:71-74` | Recharge credits coins/diamonds without checking for negative balances (acceptable for credit-only). No risk here. |
| 🟡 MEDIUM | `gameController.js:228` | `user.coins += winAmount` — non-atomic read-modify-write. If two game sessions end concurrently, both read the same balance, both add, and one write overwrites the other. **Balance drift possible.** |
| 🟡 MEDIUM | `webViewGameController.js:165-166, 228-234` | `user.coins -= betAmount` then `await user.save()` — non-atomic deduction. Two concurrent sessions could both pass the `currentCoins < betAmount` check before either saves. **Double-spend race.** |
| 🟢 OK | `dealerController.js:219-229` | Dealer transfer uses session transaction with `dealerWallet.balance -= amount` and `targetUser.coins += amount`. Balanced. |
| 🟢 OK | `dealerController.js:435-436` | Refund debits target user with session transaction and balance pre-check. |
| 🟢 OK | `salaryController.js:151` | `User.findByIdAndUpdate(record.userId, { $inc: { coins: record.totalPaid } })` — atomic increment. |
| 🟢 OK | `giftSocket.js:67-70` | Atomic `findOneAndUpdate({ _id: senderId, coins: { $gte: cost } }, { $inc: { coins: -cost } })`. |
| 🟢 OK | `withdrawalController.js:42-46` | Atomic `findOneAndUpdate` with `coins: { $gte: coins }` guard. |
| 🔴 HIGH | `giftQueueWorker.js:113-114` | `sender.coins -= gift.price; await sender.save()` — non-atomic. Two parallel gift jobs for the same sender can both pass the `sender.coins < gift.price` check at line 109, then both deduct. **Result: negative coins.** |

**Recommendation**:
- Replace all `user.coins += X; await user.save()` patterns with `User.findByIdAndUpdate(userId, { $inc: { coins: X } })`.
- Replace all `user.coins -= X; await user.save()` with atomic `findOneAndUpdate({ _id: userId, coins: { $gte: X } }, { $inc: { coins: -X } })`.
- Add a MongoDB schema-level minimum validator: `coins: { type: Number, default: 0, min: 0 }` (MongoDB 5.2+ supports `min`).

---

### 2. Double Spend

| Severity | Location | Description |
|---|---|---|
| 🟢 OK | `giftSocket.js:67-70` | Atomic deduction with `coins: { $gte: cost }` guard. Prevents double-spend. |
| 🟢 OK | `dealerController.js:149-289` | Session transaction wraps entire transfer. |
| 🟢 OK | `withdrawalController.js:42-46` | Atomic findOneAndUpdate with balance guard. |
| 🟡 MEDIUM | `webViewGameSession.startGameSession` | `user.coins -= betAmount; await user.save()` — non-atomic. If a user opens two game sessions simultaneously, both read the same balance, both deduct. |
| 🔴 HIGH | `giftQueueWorker.js:109-114` | Race condition: `if (sender.coins < gift.price)` check at line 109, then `sender.coins -= gift.price` at line 113. Between check and deduct, another job could also deduct. **Negative balance guaranteed under concurrency.** |

**Recommendation**:
- Convert `giftQueueWorker.js` to use atomic `findOneAndUpdate`.
- Convert `webViewGameController.js` start/end to use atomic ops or MongoDB sessions.

---

### 3. Race Condition

| Severity | Location | Description |
|---|---|---|
| 🟡 MEDIUM | `familyController.js:1047-1054` | `family.family_points -= item.cost; await family.save()` — non-atomic. Two concurrent shop purchases can both pass the `family_points < cost` check and overdraw. |
| 🟡 MEDIUM | `salaryController.js:137-166` | Wallet balance check at line 140 (`wallet?.balance >= totalSalary`), then deduction at line 141. Not atomic — another concurrent salary run could also pass the check. |
| 🟢 OK | `eventSocket.js:108-112` | Atomic `findOneAndUpdate({ userId, eventId, is_completed: true, is_claimed: false }, { $set: { is_claimed: true } }, { new: true })`. |
| 🟢 OK | `giftSocket.js:92-98` | Atomic room points increment, but loot box level-up is non-atomic (see Gift Events). |

**Recommendation**:
- Use `findByIdAndUpdate` with `$inc` for family point deductions.
- Wrap salary payment in a MongoDB session with pessimistic locking or use `findOneAndUpdate` with balance guard.

---

### 4. Atomic Updates

| Pattern | Count | Examples |
|---|---|---|
| ✅ Atomic `findOneAndUpdate` with `$inc` | 22 | giftSocket, withdrawal, dealer, salary, game controller |
| ✅ Session transaction | 8 | dealerController, diamondEconomy recharge, refund |
| ❌ Non-atomic read-modify-write | 11 | gameController, webViewGame, family shop, giftQueueWorker |
| ✅ Idempotency keys | 3 | lucky gift, used purchase token, refund request |

**Recommendation**:
- Establish a **financial code review checklist**: all balance mutations MUST use atomic ops or sessions.
- Extract a `FinancialHelpers` module with `safeDeduct(userId, amount, currency)` and `safeCredit(userId, amount, currency)` to enforce atomicity.

---

### 5. Fraud

| Severity | Location | Description |
|---|---|---|
| 🟢 OK | `diamondEconomyController.js:52-63` | IAP replay prevention: `UsedPurchaseToken` collection + duplicate `Recharge` check. |
| 🟡 MEDIUM | `gameController.js` | No server-side seed or nonce for game results. A client could reverse-engineer the `Math.random()` outcome and only submit wins. **Outcome verification missing.** |
| 🟡 MEDIUM | `webViewGameController.js` | `endGameSession` accepts `winAmount` from client without server-side verification. The webview game runs on the client — no trust boundary. |
| 🟡 MEDIUM | `dealerController.js:291-374` | `requestRefund` does not verify that the original transaction actually occurred. It finds the most recent `dealer_transfer_in` tx by `transactionHash` metadata, but a forged hash could match an unrelated transaction. |
| 🟢 OK | `giftSocket.js:38-41` | Self-gifting prevention: `senderId.toString() === receiverId.toString()`. |
| 🟢 OK | `withdrawalController.js` | KYC fields, workflow stages, fraud score field on model. |
| 🔴 HIGH | `giftQueueWorker.js:91-203` | **No validation that the gift price matches the sender's expectation.** The worker trusts `job.data` entirely. A malicious queue producer could enqueue a job with `giftId` pointing to an expensive gift but `senderId` of a victim. |

**Recommendation**:
- Add **server-side game outcome verification**: games must submit a signed outcome from the server or a deterministic seed hash.
- Add **refund eligibility window**: refunds only allowed within 24h of original transaction.
- Add **queue job signature**: `giftQueueWorker` should verify `job.data.senderId` matches the authenticated user who enqueued it.
- Implement **velocity checks** on refund requests per dealer.

---

## Withdrawal Security

| Control | Status | Location |
|---|---|---|
| Atomic balance deduction | ✅ | `withdrawalController.js:120-123` |
| Pending withdrawal hold | ✅ | `withdrawalController.js:51` |
| KYC requirement | ✅ | `Withdrawal` model has `kycVerified`, `bankAccount`, `panNumber` |
| Multi-stage workflow | ✅ | `currentStage` enum with 5 stages |
| Balance guard on approve | ✅ | `withdrawalController.js:111` |
| Audit log | ✅ | All withdrawal actions logged |
| Duplicate prevention | ❌ | No unique index on `(userId, amount, status='pending')` — a user could flood pending withdrawals |
| Timeout / expiry | ❌ | Pending withdrawals never expire — if Approved but not Paid, funds are stuck |

**Recommendation**:
- Add unique partial index: `db.withdrawals.createIndex({ userId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'PENDING' } })`.
- Add `expiresAt` with TTL index for pending withdrawals (7 days).

---

## Gift Flow Security

| Control | Status | Location |
|---|---|---|
| Self-gift prevention | ✅ | `giftSocket.js:39` |
| Rate limiting | ✅ | Redis 2s cooldown |
| Atomic coin deduction | ✅ | `findOneAndUpdate` with `$gte` guard |
| Atomic room points | ✅ | `$inc` on `totalGiftPoints`, `lootBoxPoints`, `rankPoints` |
| Idempotent lucky credit | ✅ | Unique `idempotencyKey` |
| Treasure claim lock | ✅ | Redis `SET NX EX` |
| Transaction logging | ✅ | `WalletTransaction` + `GiftTransaction` |
| Duplicate event fire | ❌ | `pk_update_score` registered in both `roomSocket.js` and `pkBattleSocket.js` |

**Recommendation**:
- Rename `pkBattleSocket.js` event to `pk_battle_update_score`.
- Add `giftQueueWorker.js` atomic ops fix (P0).

---

## Recharge Security

| Control | Status | Location |
|---|---|---|
| Google Play verification | ✅ | `fraudDetection.service.verifyGooglePlayPurchase` |
| Replay prevention | ✅ | `UsedPurchaseToken` + duplicate `Recharge` check |
| Transaction rollback | ✅ | MongoDB session with abort on failure |
| Amount validation | ❌ | `plan.coinsAwarded` and `plan.diamondsAwarded` are trusted from DB — if plan is tampered, no secondary check |
| Price tamper | ❌ | No verification that `plan.priceINR` matches the actual Google Play price |

**Recommendation**:
- Validate `plan.priceINR` against a server-side price list or Google Play's `price` field.
- Add server-side cap: max coins per INR to prevent plan tampering.

---

## Agency / Host Earnings

| Control | Status | Location |
|---|---|---|
| Attendance gating | ✅ | `isValidDay` requires 120+ minutes |
| Salary calculation | ✅ | Base + attendance bonus + gift commission - penalties |
| Wallet atomic credit | ✅ | `$inc` for salary |
| Payment status tracking | ✅ | `pending` → `paid` / `cancelled` |
| Duplicate salary prevention | ✅ | Unique index on `(userId, month, year)` |
| Overdraft protection | 🟡 | Balance checked before deduction, but non-atomic |

**Recommendation**:
- Wrap salary payment in a session transaction.

---

## Dealer / Coin Seller

| Control | Status | Location |
|---|---|---|
| Daily transfer limit | ✅ | `resetDailyTransfers` + pre-check |
| Per-transaction max | ✅ | `maxTransferPerTransaction` |
| Level-based limits | ✅ | silver/gold/diamond configs |
| Session transaction | ✅ | `transferCoinsToUser` uses session |
| Vault balance guard | ✅ | `sessionVault.currentBalance < amount` |
| Refund idempotency | ✅ | `existingRefund` check by `transactionHash` |
| Suspicious activity flag | ✅ | `isFlagged`, `suspiciousActivityCount` |
| Negative balance guard | ✅ | Pre-check before debit |

**Strengths**: Best-implemented financial flow in the codebase. Sessions, guards, limits, audit logs.

---

## Security Concerns Summary

| # | Severity | File | Issue |
|---|---|---|---|
| 1 | 🔴 HIGH | `giftQueueWorker.js:109-114` | Non-atomic coin deduction in BullMQ worker — negative balance under concurrency. |
| 2 | 🔴 HIGH | `webViewGameController.js:165-166` | Non-atomic `user.coins -= betAmount` — double-spend race. |
| 3 | 🟡 MEDIUM | `gameController.js:228` | Non-atomic `user.coins += winAmount` — balance drift. |
| 4 | 🟡 MEDIUM | `familyController.js:1047` | Non-atomic family points deduction — race condition. |
| 5 | 🟡 MEDIUM | `salaryController.js:140` | Non-atomic wallet deduction — race under concurrent salary runs. |
| 6 | 🟡 MEDIUM | `gameController.js` / `webViewGameController.js` | Client-submitted game outcomes without server verification. |
| 7 | 🟡 MEDIUM | `dealerController.js:325-338` | Refund finds transaction by hash without verifying original sender == refund requester. |
| 8 | 🟡 MEDIUM | `giftQueueWorker.js` | No sender authentication on enqueued jobs — forged job data accepted. |
| 9 | 🟢 LOW | `Withdrawal` model | No expiry for pending withdrawals. |
| 10 | 🟢 LOW | `diamondEconomyController.js` | No server-side price cross-check for IAP plans. |

---

## Recommendations Priority

### P0 — Financial Integrity at Risk
1. **Fix `giftQueueWorker.js` coin deduction** — use atomic `findOneAndUpdate` with `$gte` guard.
2. **Fix `webViewGameController.js` start/end** — atomic ops or session transaction.
3. **Fix `gameController.js` reward credit** — use `$inc` instead of `+=`.

### P1 — Race Conditions
4. **Fix `familyController.js` shop purchase** — atomic `$inc` with guard.
5. **Fix `salaryController.js` payment** — wrap in session transaction.
6. **Add game outcome verification** — server-side seed or signature for all games.

### P2 — Hardening
7. **Add refund eligibility check** — verify original transaction sender matches refund requester.
8. **Sign gift queue jobs** — add HMAC to job data, verify in worker.
9. **Add withdrawal expiry** — 7-day TTL on pending requests.
10. **Cross-check IAP prices** — server-side plan price validation.
11. **Extract `FinancialHelpers`** — enforce atomic ops across all controllers.

---

## Positive Patterns

- **MongoDB sessions** used correctly in dealer transfers, refunds, and recharge.
- **Atomic balance guards** (`coins: { $gte: amount }`) in gift, withdrawal, and game spins.
- **Idempotency keys** for lucky gifts and IAP tokens.
- **Audit logging** on all high-value operations (withdrawal, salary, dealer).
- **Vault pattern** for coin issuance — prevents arbitrary minting.
- **Dealer limits** (daily, per-tx, level-based) with `resetDailyTransfers`.

---

*End of report.*