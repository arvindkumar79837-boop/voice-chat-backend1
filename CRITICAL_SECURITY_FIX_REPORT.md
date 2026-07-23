# CRITICAL Security Fix Report — 10 Vulnerabilities Patched

**Date:** 2026-07-12
**Files Modified:** 7
**Severity:** All CRITICAL
**Status:** All fixes applied and verified

---

## CRIT-1 & CRIT-2: Unauthenticated Diamond Economy Routes

**File:** `src/routes/diamondEconomyRoutes.js`

**Before:**
```js
const { verifyStaff, verifyOwner } = require('../middlewares/adminMiddleware');
const ctrl = require('../controllers/diamondEconomyController');

router.post('/verify-google-play', ctrl.verifyGooglePlayRecharge);
router.get('/balance', ctrl.getWalletBalance);
```

**After:**
```js
const { authMiddleware } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/diamondEconomyController');

router.post('/verify-google-play', authMiddleware, ctrl.verifyGooglePlayRecharge);
router.get('/balance', authMiddleware, ctrl.getWalletBalance);
```

**Impact:** Any unauthenticated user could verify Google Play purchases and query wallet balances. Now requires JWT auth.

---

## CRIT-3: Withdrawal Approve/Reject Without Admin Auth

**File:** `src/routes/withdrawalRoutes.js`

**Before:**
```js
router.post('/withdrawal/approve/:id', withdrawalController.approveWithdrawal);
router.post('/withdrawal/reject/:id', withdrawalController.rejectWithdrawal);
```

**After:**
```js
const { verifyStaff } = require('../middlewares/adminMiddleware');

router.post('/withdrawal/approve/:id', verifyStaff, withdrawalController.approveWithdrawal);
router.post('/withdrawal/reject/:id', verifyStaff, withdrawalController.rejectWithdrawal);
```

**Impact:** Any authenticated user could approve/reject withdrawal requests. Now requires staff role.

---

## CRIT-4: Gift Coin Deduction Race Condition (4 locations)

**File:** `src/sockets/giftSocket.js`

**Before (all 4 locations):**
```js
const sender = await User.findById(senderId);
if (!sender || sender.coins < cost) {
  return socket.emit('gift_error', { message: 'Insufficient coins.' });
}
sender.coins -= cost;
await sender.save();
```

**After:**
```js
const updatedSender = await User.findOneAndUpdate(
  { _id: senderId, coins: { $gte: actualCost } },
  { $inc: { coins: -actualCost } },
  { new: true }
);
if (!updatedSender) {
  return socket.emit('gift_error', { message: 'Insufficient coins.' });
}
```

**Locations fixed:**
1. `handleSendGift` — single gift send
2. Lucky gift win credit — atomic `User.findByIdAndUpdate`
3. `send_combo_gift` — combo gift send
4. `claim_treasure` — treasure claim

**Impact:** Race condition allowed double-spend via concurrent socket events. Atomic MongoDB operations prevent this.

---

## CRIT-5: Chat Message Sender Spoofing

**File:** `src/sockets/chatSocket.js`

**Before:**
```js
const newMessage = await RoomMessage.create({
  roomId: data.roomId,
  senderId: data.senderId,
  message: data.message,
});
```

**After:**
```js
const senderId = socket.data.userId;
if (!senderId) {
  return socket.emit('error', { message: 'Authentication required.' });
}
const newMessage = await RoomMessage.create({
  roomId: data.roomId,
  senderId,
  message: data.message,
});
```

**Impact:** Client could set any `senderId` in the payload, impersonating any user. Now uses server-side auth identity.

---

## CRIT-6: PK Battle Client-Controlled Score

**File:** `src/sockets/pkBattleSocket.js`

**Before:**
```js
socket.on('pk_update_score', async ({ battleId, score, supportedUserId }) => {
  // score comes directly from client — arbitrary value
  battle.hostScore += score;
```

**After:**
```js
socket.on('pk_update_score', async ({ battleId, giftId, quantity, supportedUserId }) => {
  const gift = await Gift.findById(giftId);
  if (!gift || !gift.coinPrice) return;
  const validQty = Math.max(1, Math.min(parseInt(quantity) || 1, 999));
  const score = gift.coinPrice * validQty;
  battle.hostScore += score;
```

**Impact:** Client could send any score value to win PK battles instantly. Score now derived from server-verified gift price.

---

## CRIT-7: Unfiltered Notification Queries (Data Leak)

**File:** `src/controllers/notificationController.js`

**Before:**
```js
exports.getNotificationHistory = async (req, res) => {
  const notifications = await Notification.find()  // NO userId filter!
    .sort({ createdAt: -1 })
    .limit(100);
```

**After:**
```js
exports.getNotificationHistory = async (req, res) => {
  const query = { userId: req.user.userId };
  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
```

**Impact:** Any logged-in user could fetch ALL users' notifications. Now scoped to authenticated user.

---

## CRIT-8: delete_room Without Ownership Check

**File:** `src/sockets/roomSocket.js`

**Before:**
```js
socket.on('delete_room', async ({ roomId }) => {
  await Room.findOneAndDelete({ roomId });  // ANY user can delete ANY room
});
```

**After:**
```js
socket.on('delete_room', async ({ roomId }) => {
  const ownerId = authedUserId;
  const room = await Room.findOne({ roomId });
  if (!room || room.ownerId.toString() !== ownerId?.toString()) {
    return socket.emit('room_error', { message: 'Only the room owner can delete a room.' });
  }
  await Room.findOneAndDelete({ roomId });
});
```

**Impact:** Any authenticated user could delete any room. Now requires room ownership.

---

## CRIT-9: Kick/Mute Without Admin Authorization (4 handlers)

**File:** `src/sockets/roomSocket.js`

**Before (all 4 handlers had no auth):**
```js
socket.on('kick_user', async ({ roomId, targetUserId }) => {
  await Room.findOneAndUpdate({ roomId }, { $addToSet: { kickedUsers: targetUserId } });
});
```

**After:**
```js
socket.on('kick_user', async ({ roomId, targetUserId }) => {
  const room = await Room.findOne({ roomId });
  const isAuthorized =
    room.ownerId.toString() === adminId?.toString() ||
    room.coHosts.some((id) => id.toString() === adminId?.toString()) ||
    room.admins.some((id) => id.toString() === adminId?.toString());
  if (!isAuthorized) {
    return socket.emit('room_error', { message: 'Not authorized to kick users.' });
  }
  await Room.findOneAndUpdate({ roomId }, { $addToSet: { kickedUsers: targetUserId } });
});
```

**Handlers fixed:** `kick_user`, `admin_mute_user`, `unkick_user`, `admin_unmute_user`

**Impact:** Any user could kick/mute any other user. Now requires owner, coHost, or admin role.

---

## CRIT-10: Announcement/Topic Updates Without Ownership (4 handlers)

**File:** `src/sockets/roomSocket.js`

**Before (all 4 handlers had no auth):**
```js
socket.on('update_announcement', async ({ roomId, announcement }) => {
  await Room.findOneAndUpdate({ roomId }, { announcement });
});
```

**After:**
```js
socket.on('update_announcement', async ({ roomId, announcement }) => {
  const ownerId = authedUserId;
  const room = await Room.findOne({ roomId });
  if (!room || room.ownerId.toString() !== ownerId?.toString()) {
    return socket.emit('room_error', { message: 'Only the room owner can update announcements.' });
  }
  await Room.findOneAndUpdate({ roomId }, { announcement });
});
```

**Handlers fixed:** `update_announcement`, `update_pinned_message`, `update_welcome_message`, `update_topic`

**Impact:** Any user could change room announcements/topics. Now requires room ownership.

---

## BONUS: TDZ Bug Fix (Runtime Crash)

**File:** `src/sockets/roomSocket.js:27`

**Before:**
```js
room.kickedUsers.some((id) => id.toString() === userId.toString());
// userId used BEFORE declaration on line 35
const userId = authedUserId;  // line 35
```

**After:**
```js
const userId = authedUserId;  // moved to BEFORE usage
room.kickedUsers.some((id) => id.toString() === userId.toString());
```

**Impact:** Temporal Dead Zone error would crash every `join_room` event. Fixed by reordering declaration.

---

## Summary

| CRIT | File | Vulnerability | Fix |
|------|------|---------------|-----|
| 1-2 | diamondEconomyRoutes.js | Unauthenticated routes | Added `authMiddleware` |
| 3 | withdrawalRoutes.js | No admin check on approve/reject | Added `verifyStaff` |
| 4 | giftSocket.js | Race condition (4 locations) | Atomic `findOneAndUpdate` |
| 5 | chatSocket.js | Sender spoofing | Use `socket.data.userId` |
| 6 | pkBattleSocket.js | Client-controlled score | Server-side gift price lookup |
| 7 | notificationController.js | Unfiltered notification query | Added `userId` filter |
| 8 | roomSocket.js | delete_room no auth | Ownership check |
| 9 | roomSocket.js | kick/mute no auth (4 handlers) | Owner/coHost/admin check |
| 10 | roomSocket.js | announcements no auth (4 handlers) | Ownership check |
| BONUS | roomSocket.js | TDZ crash on join_room | Reordered `userId` declaration |
