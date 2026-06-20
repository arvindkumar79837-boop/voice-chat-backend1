require('dotenv').config();

// ─────────────────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLE VALIDATION
// ─────────────────────────────────────────────────────────────────────────
const requiredEnvVars = [
  'JWT_SECRET',
  'MONGO_URI',
  'PORT'
];

const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingEnvVars.length > 0) {
  console.error('❌ FATAL: Missing required environment variables:');
  missingEnvVars.forEach(key => console.error(`   - ${key}`));
  console.error('Please set these in your .env file and restart the server.');
  process.exit(1);
}

const http = require('http');
const connectDB = require('./src/config/db');
const { initializeSocket } = require('./src/config/socket');
const { initRedis } = require('./src/services/otp.service');
const app = require('./src/app');

// ─── INITIALIZE SERVICES ───────────────────────────────────────────────────
(async () => {
  // Connect to MongoDB
  try {
    await connectDB();
  } catch (error) {
    console.log('⚠️ MongoDB Connection Error - Server running without DB');
  }

  // Initialize Redis for OTP storage
  try {
    await initRedis();
  } catch (error) {
    console.log('⚠️ Redis Connection Error - Using in-memory OTP storage');
  }

  // Initialize default badges
  try {
    const badgeController = require('./src/controllers/badgeController');
    await badgeController.initializeDefaultBadges();
    console.log('✅ Default badges initialized');
  } catch (error) {
    console.log('⚠️ Badge initialization skipped:', error.message);
  }
})();

// ─── SETUP HTTP + SOCKET.IO ────────────────────────────────────────────────
const server = http.createServer(app);
const io = initializeSocket(server);

// Make `io` accessible globally inside controllers
app.set('io', io);

// ─── SETUP SOCKET HANDLERS ─────────────────────────────────────────────────
const roomSocket = require('./src/sockets/roomSocket');
const chatSocket = require('./src/sockets/chatSocket');
const seatSocket = require('./src/sockets/seatSocket');
const giftSocket = require('./src/sockets/giftSocket');
const pkBattleSocket = require('./src/sockets/pkBattleSocket');

roomSocket(io);
chatSocket(io);
seatSocket(io);
giftSocket(io);
pkBattleSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready`);
  console.log(`🌐 http://localhost:${PORT}`);
});
