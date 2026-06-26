const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Family = require('../models/Family');
const VipSystem = require('../models/VipSystem');
const CosmeticItem = require('../models/CosmeticItem');

let io;

const initializeSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.ALLOWED_ORIGINS?.split(',') || [
                'http://192.168.1.100:5000',
                'http://192.168.1.100:3000',
                'http://localhost:5000',
                'http://localhost:3000',
                process.env.MOBILE_DEEP_LINK_URL
            ],
            methods: ['GET', 'POST'],
            credentials: true
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling']
    });

    // ─── SOCKET AUTHENTICATION MIDDLEWARE ───────────────────────────────
    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
            return next(new Error('Authentication token required'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;
            socket.userRole = decoded.role;
            next();
        } catch (error) {
            console.error('Socket auth error:', error.message);
            next(new Error('Invalid or expired token'));
        }
    });

    // ─── CONNECTION LOGGING ───────────────────────────────────────────────
    io.on('connection', async (socket) => {
        const userId = socket.userId;
        console.log(`✅ Socket connected: ${userId} (${socket.id})`);

        try {
            const user = await User.findById(userId).select('familyId');
            socket.familyId = user?.familyId || null;
            socket.username = user?.username || 'Unknown';
            socket.avatar = user?.avatar || '';
        } catch (error) {
            console.error('Error fetching user data for socket:', error);
        }

        // Initialize family socket handlers
        if (socket.familyId) {
            const { setupFamilySocketHandlers } = require('./sockets/familySocket');
            setupFamilySocketHandlers(io, socket);
        }

        socket.on('disconnect', () => {
            console.log(`❌ Socket disconnected: ${userId} (${socket.id})`);
        });
    });

    // ─── VIP ENTRY EFFECT HANDLER ───────────────────────────────────────
    io.on('connection', (socket) => {
        // Handle user joining a room with VIP entry effect
        socket.on('join_room', async (data) => {
            const { roomId } = data;
            if (!roomId) return;

            socket.join(roomId);
            console.log(`User ${socket.userId} joined room ${roomId}`);

            // Check if user has VIP entry effect
            try {
                const vipData = await VipSystem.findOne({ user_uid: socket.userId.toString() });
                if (!vipData || (vipData.vip_level < 5 && !vipData.is_svip)) {
                    return; // No entry effect for normal users
                }

                const user = vipData; // In production, fetch full user data
                const entryEffect = vipData.active_cosmetics.entrance_car_id ?
                    await CosmeticItem.findOne({ item_id: vipData.active_cosmetics.entrance_car_id }).lean() :
                    null;

                // Emit vip_entry event to all users in the room (including the entering user)
                io.to(roomId).emit('vip_entry', {
                    user_uid: socket.userId.toString(),
                    vip_level: vipData.vip_level,
                    is_svip: vipData.is_svip,
                    svip_level: vipData.svip_level,
                    entrance_effect: entryEffect ? {
                        car_id: entryEffect.item_id,
                        car_name: entryEffect.item_name,
                        animation_url: entryEffect.animation_url || '',
                        animation_duration_ms: entryEffect.animation_duration_ms || 3000,
                        is_animated: entryEffect.is_animated || false
                    } : null,
                    frame_id: vipData.active_cosmetics.frame_id,
                    name_color: vipData.active_cosmetics.name_color,
                    badge_id: vipData.active_cosmetics.badge_id
                });

                // Global SVIP notification
                if (vipData.is_svip && vipData.vip_global_alerts_enabled) {
                    io.emit('vip_global_alert', {
                        type: 'svip_entry',
                        user_uid: socket.userId.toString(),
                        svip_level: vipData.svip_level,
                        room_id: roomId,
                        message: `👑 The King has entered Room ${roomId}!`,
                        timestamp: new Date()
                    });
                }
            } catch (error) {
                console.error('VIP entry effect error:', error);
            }
        });

        socket.on('leave_room', (data) => {
            const { roomId } = data;
            if (!roomId) return;
            socket.leave(roomId);
            console.log(`User ${socket.userId} left room ${roomId}`);
        });

        // Handle real-time mission progress updates
        socket.on('mission_progress', async (data) => {
            const { mission_id, progress_amount } = data;
            // This is handled by the REST API, but we can emit notifications here if needed
            console.log(`Mission progress update: ${mission_id} +${progress_amount}`);
        });

        // Handle VIP level up notifications
        socket.on('vip_level_up', (data) => {
            // Broadcast level up to user's friends
            socket.broadcast.emit('friend_level_up', {
                user_uid: socket.userId.toString(),
                new_level: data.new_level,
                is_svip: data.is_svip
            });
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket Not Initialized');
    }
    return io;
};

module.exports = {
    initializeSocket,
    getIO
};