const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const roomRoutes = require('./routes/room.routes');
const giftRoutes = require('./routes/gift.routes');
const socialRoutes = require('./routes/social.routes');

const app = express();
const server = http.createServer(app);

// 1. Initialize MongoDB Connection
connectDB();

// 2. Apply Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Setup Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/gifts', giftRoutes);
app.use('/api/social', socialRoutes);

// Basic Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: '✅ Arvind Party Backend is running perfectly!' });
});

// 4. Socket.IO Real-time Server
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`🔌 New Device Connected: ${socket.id}`);

  // Room Join Event
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`👥 User ${socket.id} joined room ${roomId}`);
  });

  // Real-time Chat Event
  socket.on('send_message', (data) => {
    // Message ko specific room ke sabhi users ko broadcast karo
    io.to(data.roomId).emit('receive_message', data);
  });

  socket.on('disconnect', () => console.log(`❌ Device Disconnected: ${socket.id}`));
});

// 5. Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Arvind Party Core Server started on port ${PORT}`);
});