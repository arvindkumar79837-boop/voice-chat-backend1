# Socket.IO Audit Report — Arvind Party Backend

**Date**: 2025-07-31  
**Scope**: All socket files in `src/sockets/`, `src/config/sockets/`, and `server.js`  
**Total Files Audited**: 18  
**Namespaces**: `/`, `/events`, `/room-features`, `/youtube`, `/analytics`, `/games`, `/game`

---

## Executive Summary

The socket layer is **comprehensive and feature-rich** but carries **critical gaps** in chat/general-event rate limiting, input validation, and some disconnect cleanup paths. Gift handling is well-secured with atomic operations and Redis-based rate limiting. The architecture uses multiple namespaces and aliased events for backward compatibility, which is sound but creates surface-area for duplicate-handler confusion.

| Category | Status |
|---|---|
| Memory Leak | 🟡 Minor (one global map, one zombie interval) |
| Duplicate Events | 🟢 Intentional aliases; one true duplicate |
| Flood Attack / Spam | 🔴 No rate limiting on chat/reactions/typing/event progress |
| Disconnect Cleanup | 🟡 Missing handlers for YouTube + Agency |
| Rate Limiting | 🟡 Only gift events protected |
| Room Join | 🟢 Strong validation on major rooms |
| Room Leave | 🟢 Atomic decrements; global disconnect catches stragglers |
| Gift Events | 🟢 Atomic ops, idempotency keys, Redis locks |
| Chat Events | 🔴 No rate limits, no sanitization, no room-membership check on private chat emitter |
| Voice Events | 🟢 Seat + mic handling solid; LiveKit integration present |

---

## Files Audited

| File | Lines | Purpose |
|---|---|---|
| `src/sockets/index.js` | 117 | Global socket init, JWT middleware, namespace wiring, global disconnect |
| `src/sockets/authSocket.js` | 141 | Auth heartbeat, force-logout ack, DeviceSession cleanup |
| `src/sockets/roomSocket.js` | 883 | Room join/leave, seats, PK, moderation, announcements, cosmetics, layout |
| `src/sockets/chatSocket.js` | 78 | Room chat, reactions, typing indicator, private chat |
| `src/sockets/giftSocket.js` | 568 | Send gift, combo gifts, treasure claim, frame/festival effects |
| `src/sockets/seatSocket.js` | 96 | Seat transfer, reorder, speaking animations |
| `src/sockets/eventSocket.js` | 231 | Event rooms, progress updates, reward claims |
| `src/sockets/pkBattleSocket.js` | 63 | PK score updates, supporter votes |
| `src/sockets/familySocket.js` | 356 | Family join/leave, chat, gift alerts, stay rewards |
| `src/sockets/agencySocket.js` | 77 | Agency room, attendance heartbeat, live updates |
| `src/sockets/analytics.socket.js` | 181 | Admin analytics dashboards with auto-broadcast intervals |
| `src/sockets/roomFeaturesSocket.js` | 491 | Room features: chat, gifts, music, singing queue, notices, privacy |
| `src/sockets/rewardSocket.js` | 152 | Game reward config broadcasting (`/game` namespace) |
| `src/sockets/powerMatrixSocket.js` | 442 | Power matrix authority checks, mute/kick via matrix rules |
| `src/sockets/matchmakingSocket.js` | 144 | Blind-date queue via Redis list |
| `src/sockets/youtubeSocket.js` | 121 | YouTube watch-party room, playlist, host controls |
| `src/config/sockets/gameSocket.js` | 146 | Webview game session handling (`/games` namespace) |
| `server.js` | 444 | Socket.IO server config, CORS, reconnection, services |

---

## Detailed Findings

### 1. Memory Leak

| Severity | Location | Description |
|---|---|---|
| 🟡 MEDIUM | `roomFeaturesSocket.js:7` | `onlineUsersInRooms` is a **module-level global Map/Set cache**. If a socket disconnects without triggering `leave-room` or the `disconnect` handler (e.g., hard crash), the Set retains stale userId entries forever. No TTL or periodic sweep. |
| 🟢 LOW | `matchmakingSocket.js:62-68` | `matchmakingInterval` is set once and **never cleared**, even if all clients disconnect. In a long-running server this is by design (cron), but if the module is reloaded (hot-restart without process restart) it leaks. |
| 🟢 LOW | `analytics.socket.js:33-170` | Per-connection `setInterval` timers are correctly cleared on `disconnect`. Verified: `intervals.forEach(clearInterval)` at line 174. |
| 🟢 LOW | `src/config/socket.js` | Singleton `io` reference. No leak; standard pattern. |

**Recommendation**:
- Replace `onlineUsersInRooms` in-memory tracking with **Redis SADDs** (it already uses Redis for family online counts). The in-memory map is a scalability killer in multi-worker setups and grows unbounded.
- Consider a TTL-based sweeper or use `socket.data` + disconnect to guarantee cleanup.

---

### 2. Duplicate Events

| Severity | Location | Description |
|---|---|---|
| 🟢 INFO | `roomSocket.js:137-138` | `join_room` and `room:join` both bind to `handleJoinRoom`. **Intentional** aliases for Flutter/client compatibility. Same pattern for `leave_room`, `toggle_mic`, `claim_seat`, `leave_seat`, `lock_seat`, `raise_hand`. |
| 🟢 INFO | `giftSocket.js:337-338` | `send_gift` and `gift:send` alias. **Intentional**. |
| 🔴 HIGH | `roomSocket.js:778` vs `pkBattleSocket.js:6` | **True duplicate**: both files register `pk_update_score`. `roomSocket.js` handles room-level PK score updates (with room membership check), while `pkBattleSocket.js` handles battle-level PK. However, the **event name is identical**. If both handlers are attached to the same socket, **both fire**, causing double DB updates and double emits. |

**Recommendation**:
- Rename `pkBattleSocket.js` handler to `pk_battle_update_score` or wrap in a namespace so only one fires.
- Audit all aliases: ensure clients only use one canonical name to reduce surface area.

---

### 3. Flood Attack / Spam Protection

| Severity | Location | Description |
|---|---|---|
| 🔴 CRITICAL | `chatSocket.js:6` | `send_room_message` — **no rate limiting**. A malicious client can fire 1000 msg/sec, saturating MongoDB writes and Socket.IO broadcast. |
| 🔴 CRITICAL | `chatSocket.js:32` | `send_reaction` — **no rate limiting**. |
| 🔴 CRITICAL | `roomFeaturesSocket.js:108` | `send-chat-message` — **no rate limiting**. |
| 🔴 HIGH | `chatSocket.js:50` | `chat:typing` — **no rate limiting**. Rapid-fire typing events waste CPU. |
| 🔴 HIGH | `eventSocket.js:63` | `update_event_progress` — **no rate limiting**. Could spam progress updates. |
| 🟡 MEDIUM | `familySocket.js:68` | `family:send_message` — Redis-backed chat history, but no rate limit on writes. |
| 🟡 MEDIUM | `youtubeSocket.js:55,70` | `youtube:toggle_play`, `youtube:seek` — **no cooldown**. A rogue client could seek 60 times/sec causing all clients to stutter. |
| 🟢 OK | `giftSocket.js:44,356` | Redis `checkRateLimit` with 2-second cooldown per user per action. Good. |
| 🟢 OK | `giftSocket.js:504` | `claim_treasure` — Redis distributed lock with 30s TTL. Good. |
| 🟢 OK | `matchmakingSocket.js` | Queue-based; Redis list is natural rate limiter. |

**Recommendation**:
- Add a **per-user, per-room Redis rate limiter** (e.g., 5 messages/10s) to `chatSocket.js:send_room_message` and `roomFeaturesSocket.js:send-chat-message`.
- Cap `chat:typing` to **1 emission/2s per user per room** using Redis SET NX.
- Add a **5s cooldown** to `eventSocket.js:update_event_progress` per user per task.
- Add **1s cooldown** to YouTube player controls.

---

### 4. Disconnect Cleanup

| Severity | Location | Description |
|---|---|---|
| 🔴 HIGH | `youtubeSocket.js` | **No `disconnect` handler**. If a user leaves without calling `youtube:leave_room`, the `YouTubePlaylist.participants` array retains a dead userId permanently. |
| 🟡 MEDIUM | `agencySocket.js` | **No `disconnect` handler**. If a host disconnects without `host_leave_agency`, they stay in the agency room (low blast radius — only impacts attendance heartbeat which is gated by `Attendance.sessionEnd`). |
| 🟢 OK | `index.js:85-110` | Global disconnect iterates `socket.rooms`, emits `room:user_left` for each room, and calls `socket.leave(room)`. Good straggler cleanup. |
| 🟢 OK | `familySocket.js:330-353` | `family:disconnect` cleans Redis online set and stay session. |
| 🟢 OK | `roomFeaturesSocket.js:456-477` | Disconnect removes from `onlineUsersInRooms` and emits `user-left`. |
| 🟢 OK | `authSocket.js:59-74` | Disconnect nulls `DeviceSession.socketId`. |
| 🟡 MEDIUM | `roomSocket.js:879-882` | Inner disconnect handler is empty (comment: "Room cleanup handled in leave_room event"). This means if a user disconnects without emitting `leave_room`, the `activeUsers` counter is **not decremented**. The global disconnect in `index.js` handles the emit, but **not the counter**. This is a **count leak** over time. |

**Recommendation**:
- Add a `disconnect` handler to `youtubeSocket.js` that removes the user from `YouTubePlaylist.participants`.
- Move `activeUsers` decrement + seat cleanup into `index.js`'s disconnect handler (or into `roomSocket.js`'s disconnect), so rapid disconnects still keep counts accurate.
- Remove dead entries from `YouTubePlaylist.participants` on room-wide periodic health checks.

---

### 5. Rate Limiting

| Severity | Location | Description |
|---|---|---|
| 🟡 MEDIUM | `chatSocket.js` | **No rate limiting on any event.** See Flood Attack section. |
| 🟡 MEDIUM | `roomFeaturesSocket.js` | **No rate limiting on chat, typing, music seeks, singing like.** |
| 🟢 OK | `giftSocket.js:14-22` | Redis `checkRateLimit` pattern; 2s cooldown keyed by `rate_limit:{action}:{userId}`. |
| 🟡 MEDIUM | `eventSocket.js:63` | Progress updates could be spam-flooded (see Flood Attack). |
| 🟢 OK | `matchmakingSocket.js` | Queue-based rate limiting. |

**Existing helper**:
```js
// giftSocket.js
const RATE_LIMIT_COOLDOWN = 2;
const checkRateLimit = async (userId, action) => { ... }
```
This helper is **not reused anywhere else**. Recommend extracting to `src/utils/socketHelpers.js` and applying to chat/typing/reaction/event-progress/YouTube controls.

---

### 6. Room Join

| Severity | Location | Description |
|---|---|---|
| 🟢 OK | `roomSocket.js:11-59` | Validates room exists, active, not banned, user not kicked. Atomically increments `activeUsers`. |
| 🟡 MEDIUM | `roomSocket.js:40` | `activeUsers` increment (`$inc: { activeUsers: 1 }`) is **not atomic with the join validation**. A client could spam `join_room` and increment the counter multiple times without leaving. The socket join is idempotent, but the DB counter is not. |
| 🟢 OK | `giftSocket.js:50` | `isUserInRoom` check before allowing gifts. |
| 🟢 OK | `familySocket.js:28-38` | Validates user is family member and family is active before joining `family:{id}`. |
| 🟢 OK | `eventSocket.js:35-42` | Validates event exists before joining `event:{id}`. |
| 🟡 MEDIUM | `roomFeaturesSocket.js:32-52` | `join-room` adds to `onlineUsersInRooms` **without verifying room existence or user membership**. Any valid JWT holder can join any room's features room. |
| 🟡 MEDIUM | `gameSocket.js:28-33` | `join_game_room` does not verify the game exists. |
| 🟢 OK | `youtubeSocket.js:14-28` | Validates playlist exists (implicitly) and adds userId to participants. |

**Recommendation**:
- Make `roomSocket.js:40` increment conditional on successful join (it already is inside try/catch, but rapid duplicate calls still hit Mongo). Add a **per-user Redis flag** `room:{roomId}:joined:{userId}` with a short TTL, and gate the $inc on it.
- `roomFeaturesSocket.js:join-room` should verify `Room.findOne({ roomId })` exists before allowing join.

---

### 7. Room Leave

| Severity | Location | Description |
|---|---|---|
| 🟢 OK | `roomSocket.js:141-197` | `handleLeaveRoom` atomically decrements `activeUsers` and clears seat data via `$set` + `arrayFilters`. Emits `user_left` and `room:user_left`. |
| 🔴 HIGH | `roomSocket.js:179-190` | **Duplicate emit**: after the first set of `user_left`/`room:user_left` at lines 171-176 and 179-190, **the same events are emitted twice** if `updatedRoom` is truthy. The handler emits once inside the `if (updatedRoom)` block and again unconditionally below. |
| 🟢 OK | `index.js:99-110` | Global disconnect emits `room:user_left` for all rooms and calls `socket.leave`. |
| 🟡 MEDIUM | `roomFeaturesSocket.js:79-106` | `leave-room` does **not** decrement any room user counter in MongoDB. It only updates the in-memory `onlineUsersInRooms` map. |
| 🟡 MEDIUM | `youtubeSocket.js:35-52` | `youtube:leave_room` removes from playlist, but **no socket.leave(roomId)** — only DB cleanup. |
| 🟢 OK | `familySocket.js:54-66` | Leaves Redis set and updates online count. |

**Recommendation**:
- Remove the unconditional duplicate emit in `roomSocket.js:179-190` (or guard it so it only emits if `!updatedRoom`).
- Add `socket.leave(roomId)` to `youtubeSocket.js:leave_room`.
- Consider persisting `onlineUsersInRooms` counts to Redis instead of memory, and decrement there on leave.

---

### 8. Gift Events

| Severity | Location | Description |
|---|---|---|
| 🟢 OK | `giftSocket.js:29-336` | `send_gift` validates: not self, rate-limited, in-room, gift exists/available, atomic coin deduction via `findOneAndUpdate({coins: {$gte: cost}}, {$inc: {coins: -cost}})`, atomic room points increment, idempotent lucky gift via unique key, full payload animation, transactional logging. |
| 🟢 OK | `giftSocket.js:341-499` | `send_combo_gift` — same protections, plus combo counter loop with 200ms delay. |
| 🟢 OK | `giftSocket.js:504-537` | `claim_treasure` — Redis distributed lock with NX + EX. |
| 🟡 MEDIUM | `giftSocket.js:92-98` | Loot box level-up check **reads after atomic increment**, so it's safe, but `lootBoxPoints` reset to 0 and `lootBoxLevel` increment is **not atomic with the check** — a concurrent gift could also level up and overwrite. Use `findOneAndUpdate` with `$inc` + conditional `$set`. |
| 🟢 OK | `roomFeaturesSocket.js:143-170` | `send-gift` is a lightweight fan-out without DB side effects. Acceptable for in-room animation only. |
| 🟢 OK | `familySocket.js:103-127` | `family:send_gift_alert` is just an alert fan-out. No coin ops. |

**Recommendation**:
- Make loot box level-up truly atomic using a single `findOneAndUpdate` with `$inc` and a condition.
- Consider adding **cooldown enforcement on gift:send in roomFeaturesSocket.js** to prevent spam animations.

---

### 9. Chat Events

| Severity | Location | Description |
|---|---|---|
| 🔴 CRITICAL | `chatSocket.js:6-29` | `send_room_message` has **no rate limiting** and **no content sanitization**. A toxic user can blast racist slurs / XSS payloads to all room members. `message` is saved as-is to MongoDB and broadcast raw. |
| 🔴 HIGH | `chatSocket.js:32-47` | `send_reaction` — validated length, but **no rate limit**. |
| 🟡 MEDIUM | `chatSocket.js:50-60` | `chat:typing` — no validation, no room-membership check. Any authed socket can emit typing events for any roomId. |
| 🟡 MEDIUM | `chatSocket.js:63-77` | `chat:private` — no receiver exists check. If `receiverId` is not in any room with namespace prefix, `io.to('user:...')` silently drops. Add `User.findById` pre-check and `emitToUser`. |
| 🟡 MEDIUM | `roomFeaturesSocket.js:108-141` | `send-chat-message` — saves no history, no sanitization, no rate limit. XP is awarded per message (`addXp('chat_message')`) with no cap — spammable. |
| 🟢 OK | `familySocket.js:68-101` | `family:send_message` — Redis-backed, capped at last 100 messages, author check. |

**Recommendation**:
- Add **input sanitization** (strip HTML/JS, profanity filter hook) before saving/broadcasting chat messages.
- Add **rate limiter**: max 5 messages/30s per room per user.
- `chat:typing` — validate `roomId` format, add cooldown (1 emit/2s).
- `chat:private` — verify receiver exists and is online before emitting.
- Cap `roomFeaturesSocket.js` XP gain per chat message to prevent XP farming.

---

### 10. Voice Events

| Severity | Location | Description |
|---|---|---|
| 🟢 OK | `roomSocket.js:200-216` | `toggle_mic` / `seat:mute` — emits `mic_status_changed` and atomically updates seat mute state in DB. |
| 🟢 OK | `roomSocket.js:219-323` | `claim_seat` / `seat:join` — validates seat availability, atomic assignment, generates LiveKit token, broadcasts seat claimed + animation. |
| 🟢 OK | `roomSocket.js:328-359` | `leave_seat` — atomic seat clear, emits vacated + animation. |
| 🟡 MEDIUM | `roomSocket.js:88-91` | Admin mute check (`isMuted`) emits `user_admin_muted` **only on join**. If a user is admin-muted mid-session, the mic toggle handler (`toggle_mic`) does **not** check `mutedUsers` array — a muted user can unmute themselves. |
| 🟢 OK | `seatSocket.js` | Seat transfer, reorder, speaking wave animations. |
| 🟢 OK | `roomFeaturesSocket.js:339-454` | Singing room queue — queue management, performer start/end, like count. |

**Recommendation**:
- In `roomSocket.js:handleToggleMic`, reject state changes if `room.mutedUsers.includes(userId)`.

---

### 11. Additional Findings

| Severity | Location | Description |
|---|---|---|
| 🟡 MEDIUM | `pkBattleSocket.js:6` vs `roomSocket.js:778` | Same event name `pk_update_score` registered in two files. Both fire on the default namespace. Causes double scoring if a client is in both room contexts. |
| 🟡 MEDIUM | `eventSocket.js:108-112` | `claim_event_reward` uses atomic `findOneAndUpdate` with `is_claimed: false` — **good**. But emits `reward_claimed` to the claimant and `user_claimed_reward` to the room. If an admin manually credits rewards outside this flow, no socket event. Acceptable. |
| 🟡 MEDIUM | `eventSocket.js:63-103` | `update_event_progress` allows clients to **self-report progress values**. `progress.progress += progress_value` with no server-side validation of task completion criteria. A client could send `{ progress_value: 9999 }` to complete tasks instantly. |
| 🔴 HIGH | `roomSocket.js:778-813` | `pk_update_score` — the `roomId` membership check uses `io.in(roomId).fetchSockets()` which is **O(n)** per call. Under heavy load this is expensive. Also, the `score` is `parseInt(score, 10) || 1` — min score is 1 even if `gift.coinPrice` is 0. |
| 🟡 MEDIUM | `powerMatrixSocket.js:347-421` | `validateSocketPower` is called twice in `room:mute_user` (line 98 and again inside its own implementation? no, it's once per handler). However, it performs **4 parallel DB queries** (actor, target, powerMatrix, room) every call. Cache `PowerMatrix.findOne({isActive:true})` in memory with a version watch. |
| 🟡 MEDIUM | `rewardSocket.js:14` | Namespace `/game` is created inside `initRewardSocket` but the file is named `rewardSocket.js`. This namespace path overlaps with `src/config/sockets/gameSocket.js` which uses `/games`. **Different paths** — no collision. But naming confusion. |
| 🟡 MEDIUM | `matchmakingSocket.js:62-68` | `matchmakingInterval` runs every 5 seconds, but `server.js:147-154` also runs a blind-date cron every 3 seconds via `blindDateController.processQueue`. **Two independent matchers** running in parallel. Race condition: both may pop the same users. |

**Recommendation**:
- Unify matchmaking: either use the socket module interval **or** the cron job, not both. Remove `matchmakingSocket.js:62-68` and rely on the cron, or remove the cron.
- Cache `PowerMatrix` in a module-level variable with invalidation on update.
- Add server-side task completion verifier to `eventSocket.js:update_event_progress` (progress should be validated against task type rules, not just incremented by client input).
- Consider debouncing or batching `pk_update_score` with Redis INCR.

---

## Voice Chat Architecture Notes

The backend does **not** implement raw WebRTC or media socket streams. Voice is handled via **LiveKit** integration:
- `roomSocket.js:62-66` — generates LiveKit JWT token on room join.
- `roomSocket.js:290-308` — generates LiveKit token on seat claim.

Clients connect to LiveKit separately. The socket layer only handles **signaling** (join, leave, mute, seat claim). This is a secure, production-grade pattern.

---

## Security Concerns

| # | Severity | File | Issue |
|---|---|---|---|
| 1 | 🔴 CRITICAL | `chatSocket.js` | No input sanitization — XSS / toxicity risk. |
| 2 | 🔴 HIGH | `chatSocket.js` | No rate limiting — flood/spam risk. |
| 3 | 🔴 HIGH | `eventSocket.js` | Client-self-reported progress values can be inflated to complete tasks instantly. |
| 4 | 🟡 MEDIUM | `youtubeSocket.js` | No disconnect cleanup — zombie participants. |
| 5 | 🟡 MEDIUM | `roomFeaturesSocket.js` | XP spammable via chat messages (no cap). |
| 6 | 🟡 MEDIUM | `pkBattleSocket.js` + `roomSocket.js` | Duplicate `pk_update_score` registration. |
| 7 | 🟡 MEDIUM | `roomSocket.js` | Admin-muted users can unmute themselves via `toggle_mic`. |
| 8 | 🟡 MEDIUM | `matchmakingSocket.js` + `server.js` | Dual matchmaking intervals (5s socket + 3s cron) — race condition. |
| 9 | 🟢 LOW | `roomSocket.js` | `activeUsers` counter leak on abrupt disconnect. |
| 10 | 🟢 LOW | `roomFeaturesSocket.js:7` | `onlineUsersInRooms` global map never TTL-expired. |

---

## Rate Limiting Gaps Summary

| Event | File | Rate Limited? |
|---|---|---|
| `send_room_message` | `chatSocket.js` | ❌ No |
| `send_reaction` | `chatSocket.js` | ❌ No |
| `chat:typing` | `chatSocket.js` | ❌ No |
| `chat:private` | `chatSocket.js` | ❌ No |
| `send_gift` | `giftSocket.js` | ✅ Yes (2s Redis) |
| `send_combo_gift` | `giftSocket.js` | ✅ Yes (2s Redis) |
| `claim_treasure` | `giftSocket.js` | ✅ Yes (Redis lock NX) |
| `claim_event_reward` | `eventSocket.js` | ✅ Idempotent (atomic) |
| `update_event_progress` | `eventSocket.js` | ❌ No |
| `send-chat-message` | `roomFeaturesSocket.js` | ❌ No |
| `singing:like` | `roomFeaturesSocket.js` | ❌ No |
| `pk_update_score` | `pkBattleSocket.js` | ❌ No |
| `youtube:toggle_play` | `youtubeSocket.js` | ❌ No |
| `youtube:seek` | `youtubeSocket.js` | ❌ No |
| `agency_attendance_heartbeat` | `agencySocket.js` | ❌ No (but gated by Attendance state) |

---

## Recommendations Priority

### P0 — Production Incidents Waiting to Happen
1. **Sanitize chat inputs** — strip HTML/JS, add profanity hook. (`chatSocket.js`, `roomFeaturesSocket.js`)
2. **Add rate limiters** — 5 msgs/30s per room, 1 typing/2s, 5 reactions/10s.
3. **Fix event self-reporting** — `eventSocket.js:update_event_progress` must validate on server, not trust client delta.
4. **Remove duplicate `pk_update_score`** — risk of double DB writes.

### P1 — Data Integrity / Scalability
5. **Fix activeUsers leak on disconnect** — move decrement into global disconnect or add `roomSocket.js` disconnect handler.
6. **Unify matchmaking intervals** — pick one (cron) and delete the other.
7. **Add YouTube disconnect cleanup** — remove from `YouTubePlaylist.participants`.
8. **Fix loot box level-up race** — use atomic `findOneAndUpdate`.

### P2 — Technical Debt
9. **Replace `onlineUsersInRooms` with Redis SADDs** for multi-worker compatibility.
10. **Cache PowerMatrix** in memory with invalidation.
11. **Add `toggle_mic` muted-user guard** in `roomSocket.js`.
12. **Consolidate event aliases** — pick canonical names, deprecate legacy aliases.

---

## Positive Patterns

- **Atomic MongoDB ops** for coins, seats, and activeUsers — prevents double-spend and race conditions.
- **Redis-backed rate limiting** in gift flow — excellent.
- **Idempotency keys** for lucky gifts — prevents double-credit.
- **Graceful shutdown** in `server.js` — closes HTTP, Socket.IO, and Redis cleanly.
- **Namespace isolation** — `/events`, `/room-features`, `/youtube`, `/analytics`, `/games`, `/game` provide logical separation.
- **JWT auth middleware** on every namespace — prevents unauthenticated access.
- **Comprehensive logging** via `Logger` — aids debugging.

---

*End of report.*