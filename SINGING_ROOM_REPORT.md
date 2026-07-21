# Singing Room Feature — Backend Report (MASTER PROMPT #15)

## ✅ Completed Features

### Song Library
- `Song` model: `title, artist, audioUrl, lyricsUrl (LRC), durationSeconds, coverImageUrl, genre, language, totalPlays`
- `GET /api/singing/songs?search=&genre=&language=` — search + filter + pagination
- Owner panel CRUD: `POST/PUT/DELETE /api/singing/songs`
- Shared with Music Library (Prompt #13) — same Song model

### Room Model Updates
- Added `'SINGING'` to `roomType` enum
- New fields: `currentPerformerId`, `currentSongId`, `performanceStartedAt`, `micQueue: [ObjectId]`, `micQueueSongs: [ObjectId]`, `singingLikeCount`

### Mic Queue System
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/singing/queue/join` | POST | Join Sing Next queue with songId |
| `/api/singing/queue/leave` | POST | Leave queue |
| `/api/singing/queue/:roomId` | GET | Get queue list with user + song info |
| `/api/singing/queue/remove` | POST | Host/mod remove user from queue |

### Performance Control
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/singing/performance/start` | POST | Host starts next performer (auto-pops from queue) |
| `/api/singing/performance/end` | POST | End current performance (auto-advances if queue has entries) |
| `/api/singing/performance/mute` | POST | Force-mute current performer |

### Socket Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `singing:join-queue` | C→S | Join queue via socket |
| `singing:leave-queue` | C→S | Leave queue via socket |
| `singing:start` | C→S | Host starts next performer |
| `singing:end` | C→S | End current performance |
| `singing:like` | C→S | Audience tap like |
| `singing:sync` | C→S | Late-joiner sync request |
| `singing:next-performer` | S→C | Broadcast new performer + song + timestamp |
| `singing:performance-ended` | S→C | Broadcast ended + total likes |
| `singing:like-count` | S→C | Real-time like counter |
| `singing:queue-updated` | S→C | Queue length update |
| `singing:queue-joined` | S→C | Confirm join + position |
| `singing:sync-response` | S→C | Full state for late joiners |
| `singing:remove-from-queue` | C→S | Host removes user |

### Live Sync
- `singing:sync` event returns `serverTimestamp` + `startedAt` + `songId`
- Clients calculate offset: `elapsed = now - serverTimestamp + (startedAt - serverTimestamp)`
- Same pattern as Prompt #11 music sync — reuse

### Audience Interaction
- Gifts: Existing gift system reused (Room ID + performer target)
- Likes: Redis-free in-memory counter on Room doc, socket-broadcast to all

### Configuration
| Setting | Default | Description |
|---------|---------|-------------|
| `singing_max_queue_size` | 20 | Max Sing Next queue length |
| `singing_max_performance_seconds` | 300 | Max 5 min per performance |

### Files Created/Modified
- `src/models/Song.js` — NEW
- `src/models/Room.js` — EDITED (SINGING roomType + 6 new fields)
- `src/controllers/singingController.js` — NEW (11 functions)
- `src/routes/singingRoutes.js` — NEW (11 endpoints)
- `src/sockets/roomFeaturesSocket.js` — EDITED (9 new socket events)
- `src/models/SystemSettings.js` — EDITED (2 new defaults)
- `src/app.js` — EDITED (mount singing routes)
- `SINGING_ROOM_REPORT.md` — NEW
