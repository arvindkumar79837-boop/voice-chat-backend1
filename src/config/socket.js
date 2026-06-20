const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

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
    io.on('connection', (socket) => {
        console.log(`✅ Socket connected: ${socket.userId} (${socket.id})`);

        socket.on('disconnect', () => {
            console.log(`❌ Socket disconnected: ${socket.userId} (${socket.id})`);
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
