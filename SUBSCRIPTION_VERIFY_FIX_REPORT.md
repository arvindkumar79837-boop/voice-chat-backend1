# Subscription Verification Fix Report (MASTER PROMPT #18)

## ✅ Fixes Applied

### 1. Google Play Subscription Verification (was TODO/fake)

**Before** (CRITICAL — trusts client receipt):
```js
// TODO: Verify receipt with Google Play Developer API
const expiresAt = new Date(Date.now() + tier.durationDays * 86400000);
```

**After** (real server-side verification):
- Uses `verifyGooglePlaySubscription()` from `fraudDetection.service.js`
- Calls Google Play Android Publisher API: `purchases/subscriptions/{productId}/tokens/{purchaseToken}`
- Validates `paymentState` (must be 1=paid or 2=free trial)
- Checks `expiryTimeMillis` to reject expired subscriptions
- Uses Google Play's actual expiry time instead of calculated fallback

### 2. New Function: `verifyGooglePlaySubscription`

Separate from `verifyGooglePlayPurchase` (which uses `purchases/products` endpoint for one-time coin packs). Subscription verification uses `purchases/subscriptions` endpoint which returns different fields:
- `paymentState`: 0=pending, 1=paid, 2=trial, 3=deferred
- `expiryTimeMillis`: actual subscription expiry from Google
- `cancelReason`: why user cancelled (if applicable)
- Dev mode: returns simulated success (no real verification possible without service account)

### 3. Duplicate Purchase Token Prevention

New model `SubscriptionPurchaseLog`:
- `{ userId, purchaseToken (unique), productId, tierId, expiresAt, status, verificationResponse }`
- `verifyPlaySubscription` now checks `SubscriptionPurchaseLog.findOne({ purchaseToken })` before processing
- Same purchase token cannot be used twice — prevents subscription fraud

### 4. Atomic Monthly Coins Claim (bonus fix)

`claimMonthlyCoins` had `user.coins += amount; await user.save()` — fixed to atomic `User.findByIdAndUpdate({ $inc: { coins } })`.

### Testing

1. **Dev mode** (no `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`): Any token passes verification — use for local testing
2. **Production**: Fake/invalid tokens will fail with `Subscription verification failed: <reason>`
3. **Duplicate token**: Second attempt returns `This purchase has already been processed`

### Files Modified
- `src/models/SubscriptionPurchaseLog.js` — NEW (duplicate token tracking)
- `src/services/fraudDetection.service.js` — EDITED (added `verifyGooglePlaySubscription`, exported)
- `src/controllers/premiumSubscriptionController.js` — EDITED (real verification, duplicate check, atomic claimMonthlyCoins)
- `SUBSCRIPTION_VERIFY_FIX_REPORT.md` — NEW
