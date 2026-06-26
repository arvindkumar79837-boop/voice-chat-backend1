const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middlewares/errorHandler.middleware');
const corsConfig = require('./config/cors');
const requestLoggerMiddleware = require('./middlewares/request-logger.middleware');
const Logger = require('./utils/logger');

// ─── IMPORTING ALL PRODUCTION ROUTES ───────────────────────────────────────
const authRoutes = require('./routes/auth.routes');
const authSecureController = require('./controllers/authSecure.controller');
const googleAuthRoutes = require('./routes/googleAuthRoutes');
const firebaseAuthRoutes = require('./routes/firebaseAuth.routes');
const userRoutes = require('./routes/user.routes');
const adminRoutes = require('./routes/adminRoutes');
const staffRoutes = require('./routes/staffRoutes');
const securityRoutes = require('./routes/securityRoutes');
const socialAuthRoutes = require('./routes/socialAuthRoutes');
const roomRoutes = require('./routes/room.routes');
const giftRoutes = require('./routes/gift.routes');
const walletRoutes = require('./routes/wallet.routes');
const agencyRoutes = require('./routes/agencyRoutes');
const pkBattleRoutes = require('./routes/pkBattleRoutes');
const dealerRoutes = require('./routes/dealer.routes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const salaryRoutes = require('./routes/salaryRoutes');
const agentRoutes = require('./routes/agentRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const penaltyRoutes = require('./routes/penaltyRoutes');
const bonusRoutes = require('./routes/bonusRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const familyRoutes = require('./routes/familyRoutes');
const shopRoutes = require('./routes/shopRoutes');
const gameRoutes = require('./routes/gameRoutes');
const webViewGameRoutes = require('./routes/webViewGameRoutes');
const cpRoutes = require('./routes/cpRoutes');
const treasuryRoutes = require('./routes/treasuryRoutes');
const matchmakingRoutes = require('./routes/matchmakingRoutes');
const rankingRoutes = require('./routes/rankingRoutes');
const vipRoutes = require('./routes/vipRoutes');
const vipSystemRoutes = require('./routes/vipSystemRoutes');
const chatRoutes = require('./routes/chatRoutes');
const appUserRoutes = require('./routes/appUserRoutes');
const levelRoutes = require('./routes/level.routes');
const agoraRoutes = require('./controllers/agoraController');
const inventoryRoutes = require('./routes/inventory.routes');
const creatorRoutes = require('./routes/creator.routes');
const supportRoutes = require('./routes/support.routes');
const moderationRoutes = require('./routes/moderation.routes');
const referralRoutes = require('./routes/referral.routes');
const momentRoutes = require('./routes/momentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const agencyInvitationRoutes = require('./routes/agencyInvitationRoutes');
const eventRoutes = require('./routes/eventRoutes');
const tournamentRoutes = require('./routes/tournamentRoutes');
const treasureHuntRoutes = require('./routes/treasureHuntRoutes');
const targetRoutes = require('./routes/targetRoutes');
const luckyDrawRoutes = require('./routes/luckyDrawRoutes');
const dailyTaskRoutes = require('./routes/dailyTaskRoutes');
const inviteRoutes = require('./routes/inviteRoutes');
const loginStreakRoutes = require('./routes/loginStreakRoutes');
const analyticsRoutes = require('./routes/analytics.routes');
const healthRoutes = require('./routes/healthRoutes');
const moduleManagerRoutes = require('./routes/moduleManagerRoutes');
const localizationRoutes = require('./routes/localizationRoutes');
const infrastructureRoutes = require('./routes/infrastructureRoutes');
const profileRoutes = require('./routes/profileRoutes');
const antiBanRoutes = require('./routes/antiBanRoutes');
const roomFeaturesRoutes = require('./routes/roomFeaturesRoutes');
const youtubeRoutes = require('./routes/youtube.routes');

const app = express();

// ─── SECURITY MIDDLEWARES ────────────────────────────────────────────────
app.use(helmet()); // Protects against XSS, clickjacking, etc.
app.use(requestLoggerMiddleware); // Log all incoming requests
app.use(corsConfig); // Enable CORS for Web Panel & App

// Increase JSON body size for Base64 image uploads if necessary
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiter for general APIs
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: { success: false, message: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', apiLimiter);

// ─── STRICT RATE LIMITING FOR AUTH ENDPOINTS ───────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 attempts per IP per 15 min
  skipSuccessfulRequests: false, // count all requests
  message: { success: false, message: 'Too many login attempts. Please try again later.' }
});

const otpLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 3, // max 3 OTP attempts per minute
  skipSuccessfulRequests: false,
  message: { success: false, message: 'Too many OTP verification attempts. Please try again in 1 minute.' }
});

// ─── WELCOME & HEALTH CHECK ROUTES ─────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🦁 ARVIND PARTY API Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.use('/api/health', healthRoutes);

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
// Firebase + secure auth (refresh rotation, session revocation)
app.use('/api/auth', authLimiter, require('./routes/authSecure.routes'));
app.use('/api/auth/social', require('./routes/googleAuthRoutes')); // Google + Apple OAuth
app.use('/api/auth/social', socialAuthRoutes); // Social Login (Google, Apple, Facebook, Snapchat, Instagram, Guest)
app.use('/api/auth', authLimiter, firebaseAuthRoutes); // Firebase ID Token + Apple Sign-In
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);         // Dashboard, Coin Control, Ban, Withdrawals
app.use('/api/admin/modules', moduleManagerRoutes); // Specialized Manager Modules
app.use('/api/localization', localizationRoutes); // Multi-Language & Translation Management
app.use('/api/staff', staffRoutes);         // Staff Management (Owner Only)
app.use('/api/security', securityRoutes);   // Security Dashboard (Fraud, Devices, IPs, Audit)
app.use('/api/rooms', roomRoutes);          // Live Rooms
app.use('/api/gifts', giftRoutes);          // Gift Sending
app.use('/api/wallet', walletRoutes);       // Recharges, Transactions
app.use('/api/agency', agencyRoutes);       // Agency Panel
app.use('/api/agency', salaryRoutes);       // Agency Salary & Attendance
app.use('/api/agency', agentRoutes);        // Agency Agents
app.use('/api/agency', withdrawalRoutes);   // Agency Withdrawals
app.use('/api/agency', penaltyRoutes);      // Agency Penalties
app.use('/api/agency', bonusRoutes);        // Agency Bonuses
app.use('/api/agency', reportsRoutes);      // Agency Reports & Analytics
app.use('/api/dealer', dealerRoutes);       // Dealer / Coin Seller Wallet System
app.use('/api/pk-battles', pkBattleRoutes); // Realtime PK Battles
app.use('/api/families', familyRoutes);     // Family/Guild System
app.use('/api/family-chat', require('./routes/familyChatRoutes')); // Family Chat
app.use('/api/shop', shopRoutes);           // Frames, Mounts, Badges
app.use('/api/games', gameRoutes);          // Lucky Wheel, Scratch Card
app.use('/api/cp', cpRoutes);               // Couple Pair System
app.use('/api/treasury', treasuryRoutes);   // Global Treasury
app.use('/api/matchmaking', matchmakingRoutes); // Dating/Matching
app.use('/api/rankings', rankingRoutes);        // Wealth & Charm Rankings
app.use('/api/vip', vipRoutes);                 // VIP Plans & Purchase
app.use('/api/vip-system', vipSystemRoutes);    // VIP 1-15, SVIP, Premium, Cosmetics, Missions
app.use('/api/chat', chatRoutes);               // Chat Message History
app.use('/api/app-users', appUserRoutes);       // App User Actions (Agency, Withdrawal)
app.use('/api/analytics', analyticsRoutes);     // App-wide Analytics & Revenue Dashboard

// ─── NEW ROUTES ────────────────────────────────────────────────────────────
app.use('/api/level', levelRoutes);             // User Levels & XP
app.use('/api/inventory', inventoryRoutes);     // User Inventory
app.use('/api/creator', creatorRoutes);         // Creator Economy
app.use('/api/support', supportRoutes);         // Support & Tickets
app.use('/api/moderation', moderationRoutes);   // Reports & Moderation
app.use('/api/referral', referralRoutes);       // Referral System
app.use('/api/room', agoraRoutes);              // Agora token & seat management
app.use('/api/moments', momentRoutes);          // Moments / Posts Feed
app.use('/api/notifications', notificationRoutes); // Notifications
app.use('/api/agency/invitations', agencyInvitationRoutes); // Agency Invitations & Inbox
app.use('/api/events', eventRoutes);            // Events
app.use('/api/tournaments', tournamentRoutes);  // Tournaments & Championships
app.use('/api/treasure-hunts', treasureHuntRoutes); // Treasure Hunts
app.use('/api/targets', targetRoutes);          // Streamer Targets & 50-50 Split

// ─── NEW EVENT SYSTEM ROUTES ────────────────────────────────────────────────
app.use('/api/lucky-draws', luckyDrawRoutes);     // Lucky Wheel Spinner
app.use('/api/daily-tasks', dailyTaskRoutes);     // Daily Tasks & Progress
app.use('/api/invites', inviteRoutes);            // Referral/Invite Events
app.use('/api/login-streak', loginStreakRoutes);  // Login Streak Rewards

// ─── INFRASTRUCTURE MANAGEMENT ROUTES ──────────────────────────────────────
app.use('/api/infrastructure', infrastructureRoutes); // Auto-Scaling, CDN, Backup, Monitoring, Deployment, Feature Flags

// ─── USER PROFILE ROUTES ──────────────────────────────────────────────────
app.use('/api/social', socialRoutes); // Follow, Unfollow, Block, Visitors
app.use('/api/profile', profileRoutes); // Avatar, Display Name, Bio, XP, Level, Badges

// ─── ANTI-BAN & DEVICE MANAGEMENT ROUTES ──────────────────────────────────
app.use('/api/admin/anti-ban', antiBanRoutes); // Permanent Device Ban (Owner Only)

// ─── ROOM FEATURES ROUTES ──────────────────────────────────────────────────
app.use('/api/rooms/features', roomFeaturesRoutes);
app.use('/api/youtube', youtubeRoutes);              // Shared YouTube Playlist & Player Control

// ─── 404 HANDLER ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

// ─── GLOBAL ERROR HANDLER (Must be LAST) ───────────────────────────────────
app.use(errorHandler);

module.exports = app;