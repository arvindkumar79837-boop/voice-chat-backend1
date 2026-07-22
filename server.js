const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  console.error('❌ FATAL: .env file not found!');
  console.error('');
  console.error('   Run the following command to get started:');
  console.error('   $ cp .env.example .env');
  console.error('');
  console.error('   Then edit .env with your configuration values.');
  console.error('');
  process.exit(1);
}

require('dotenv').config({ path: envPath });

// ─────────────────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLE VALIDATION
// ─────────────────────────────────────────────────────────────────────────
const requiredEnvVars = [
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'MONGO_URI',
  'PORT'
];

const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingEnvVars.length > 0) {
  console.error('❌ FATAL: Missing required environment variables:');
  missingEnvVars.forEach(key => console.error(`   - ${key}`));
  console.error('');
  console.error('   Edit your .env file and add the missing values,');
  console.error('   then restart the server.');
  console.error('');
  process.exit(1);
}

const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./src/config/db');
const { setIO } = require('./src/config/socket');
const { initRedis } = require('./src/services/otp.service');
const { connectRedis } = require('./src/config/redis');
const app = require('./src/app');
const { initializeFirebaseAdmin } = require('./src/config/firebase-admin');

// ─── SETUP HTTP + SOCKET.IO ────────────────────────────────────────────────
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : [
          'http://localhost:3000',
          'http://localhost:5000',
          'http://localhost:8080',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:5000',
        ]),
    methods: ['GET', 'POST'],
    credentials: true
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  transports: ['websocket', 'polling']
});
setIO(io);

// Make `io` accessible globally inside controllers
app.set('io', io);

// ─── SETUP SOCKET HANDLERS ─────────────────────────────────────────────────
const { initializeSockets } = require('./src/sockets');
initializeSockets(io);

// ─── START ANALYTICS WORKER ─────────────────────────────────────────────
try {
  const AnalyticsWorker = require('./src/workers/analyticsWorker');
  const analyticsWorker = new AnalyticsWorker(io);
  analyticsWorker.start();
  console.log('✅ Analytics Worker initialized');
} catch (error) {
  console.log('⚠️ Analytics Worker initialization skipped:', error.message);
}

// ─── START SCHEDULER SERVICE ──────────────────────────────────────────────
const SchedulerService = require('./src/services/schedulerService');

// Daily check: reset attendance flags for previous day and process end-of-day summaries
SchedulerService.startScheduler(24 * 60 * 60 * 1000);

// Monthly salary cron: runs at midnight on the 1st of every month
const cron = require('node-cron');
cron.schedule('0 0 1 * *', async () => {
  try {
    const Agency = require('./src/models/Agency');
    const SalaryRecord = require('./src/models/SalaryRecord');
    const agencies = await Agency.find({ isActive: true });
    for (const agency of agencies) {
      const now = new Date();
      const lastMonth = now.getMonth();
      const year = now.getFullYear();
      const existing = await SalaryRecord.findOne({ agencyId: agency._id, month: lastMonth, year });
      if (!existing) {
        const salaryController = require('./src/controllers/salaryController');
        await salaryController.calculateMonthlySalary({ params: { agencyId: agency._id.toString() } }, { status: () => ({ json: () => {} }) });
      }
    }
    console.log('✅ Monthly salary cron executed for all agencies');
  } catch (error) {
    console.error('Monthly salary cron error:', error);
  }
});

// Agency Target expiry check: runs every 6 hours
cron.schedule('0 */6 * * *', async () => {
  try {
    const agencyTargetController = require('./src/controllers/agencyTargetController');
    const expiredCount = await agencyTargetController.checkExpiredTargets();
    if (expiredCount > 0) {
      console.log(`✅ Agency target expiry check: ${expiredCount} targets updated`);
    }
  } catch (error) {
    console.error('Agency target expiry cron error:', error);
  }
});

// Subscription expiry check: runs daily at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    const premiumSubscriptionController = require('./src/controllers/premiumSubscriptionController');
    const deactivated = await premiumSubscriptionController.deactivateExpiredSubscriptions();
    if (deactivated > 0) {
      console.log(`✅ Subscription expiry cron: ${deactivated} subscriptions deactivated`);
    }
  } catch (error) {
    console.error('Subscription expiry cron error:', error);
  }
});

// Blind Date queue processor: runs every 3 seconds
cron.schedule('*/3 * * * * *', async () => {
  try {
    const blindDateController = require('./src/controllers/blindDateController');
    await blindDateController.processQueue();
  } catch (error) {
    // Silent — errors logged inside processQueue
  }
});

// ─── INITIALIZE SERVICES ───────────────────────────────────────────────────
(async function initializeServices() {
  try {
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

  // Initialize Redis for ranking service
  try {
    await connectRedis();
  } catch (error) {
    console.log('⚠️ Ranking Redis Connection Error - Rankings will use MongoDB fallback');
  }

  // Initialize Firebase Admin SDK
  try {
    initializeFirebaseAdmin();
    console.log('✅ Firebase Admin SDK initialized');
  } catch (error) {
    console.log('⚠️ Firebase Admin SDK initialization skipped:', error.message);
  }

  // Initialize default badges
  try {
    const badgeController = require('./src/controllers/badgeController');
    await badgeController.initializeDefaultBadges();
    console.log('✅ Default badges initialized');
  } catch (error) {
    console.log('⚠️ Badge initialization skipped:', error.message);
  }

  // Initialize VIP system default cosmetics
  try {
    const vipSystemController = require('./src/controllers/vipSystemController');
    await vipSystemController.initializeDefaultCosmetics();
  } catch (error) {
    console.log('⚠️ VIP cosmetics initialization skipped:', error.message);
  }

  // Initialize Power Matrix default configuration
  try {
    const powerMatrixController = require('./src/controllers/powerMatrixController');
    await powerMatrixController.initializePowerMatrix('SYSTEM_INITIALIZATION');
    console.log('✅ Power Matrix initialized');
  } catch (error) {
    console.log('⚠️ Power Matrix initialization skipped:', error.message);
  }

  // Initialize Event Scheduler (checks every 60 seconds for auto-activation/expiration)
  try {
    const EventSchedulerService = require('./src/services/eventSchedulerService');
    EventSchedulerService.start(60000);
    console.log('✅ Event Scheduler initialized');
  } catch (error) {
    console.log('⚠️ Event Scheduler initialization skipped:', error.message);
  }

  // Initialize Queue Service (BullMQ for background task processing)
  try {
    const queueService = require('./src/services/queueService');
    await queueService.connect();
    console.log('✅ Queue Service initialized');
    
    // Initialize Gift Queue Worker after Queue Service is connected
    try {
      const GiftQueueWorker = require('./src/workers/giftQueueWorker');
      await GiftQueueWorker.start();
      console.log('✅ Gift Queue Worker initialized');
    } catch (error) {
      console.log('⚠️ Gift Queue Worker initialization skipped:', error.message);
    }
  } catch (error) {
    console.log('⚠️ Queue Service initialization skipped:', error.message);
  }

  // Initialize Monitoring Service
  try {
    const monitoringService = require('./src/services/monitoringService');
    monitoringService.startCollection(5000);
    console.log('✅ Monitoring Service initialized');
  } catch (error) {
    console.log('⚠️ Monitoring Service initialization skipped:', error.message);
  }

  // Initialize Media Storage Service
  try {
    const mediaStorageService = require('./src/services/mediaStorageService');
    await mediaStorageService.initialize();
    console.log('✅ Media Storage Service initialized');
  } catch (error) {
    console.log('⚠️ Media Storage Service initialization skipped:', error.message);
  }

  // Initialize CDN Service
  try {
    const cdnService = require('./src/services/cdnService');
    const cdnInitialized = cdnService.initialize();
    if (cdnInitialized) {
      console.log('✅ CDN Service initialized');
    } else {
      console.log('⚠️ CDN Service initialization skipped');
    }
  } catch (error) {
    console.log('⚠️ CDN Service initialization skipped:', error.message);
  }

  // Initialize Auto Scaling Service (only in production with ENABLE_AUTOSCALING=true)
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_AUTOSCALING === 'true') {
    try {
      const autoScalingService = require('./src/services/autoScalingService');
      autoScalingService.setIo(io);
      autoScalingService.start();
      console.log('✅ Auto Scaling Service initialized in Production mode.');
    } catch (error) {
      console.log('⚠️ Auto Scaling Service initialization skipped:', error.message);
    }
  } else {
    console.log('⚠️ Auto Scaling is disabled (Development Mode / Local Machine).');
  }

  // Initialize Backup Service (only when ENABLE_BACKUP=true, saves RAM locally)
  if (process.env.ENABLE_BACKUP === 'true') {
    try {
      const backupService = require('./src/services/backupService');
      await backupService.initialize({
        interval: parseInt(process.env.BACKUP_INTERVAL_MINUTES) || 60
      });
      console.log('✅ Backup Service initialized');
    } catch (error) {
      console.log('⚠️ Backup Service initialization skipped:', error.message);
    }
  } else {
    console.log('⚠️ Backup Service skipped to save RAM on local machine.');
  }

  // Initialize Error Reporting Service (Sentry)
  try {
    const errorReportingService = require('./src/services/errorReportingService');
    errorReportingService.initialize();
    console.log('✅ Error Reporting Service initialized');
  } catch (error) {
    console.log('⚠️ Error Reporting Service initialization skipped:', error.message);
  }

  // Initialize Audit Logging Service
  try {
    const auditLogService = require('./src/services/auditLogService');
    await auditLogService.initialize();
    console.log('✅ Audit Logging Service initialized');
  } catch (error) {
    console.log('⚠️ Audit Logging Service initialization skipped:', error.message);
  }

  // Initialize Health Alert Service
  try {
    const healthAlertService = require('./src/services/healthAlertService');
    healthAlertService.initialize();
    console.log('✅ Health Alert Service initialized');
  } catch (error) {
    console.log('⚠️ Health Alert Service initialization skipped:', error.message);
  }

  // Initialize Deployment Service
  try {
    const deploymentService = require('./src/services/deploymentService');
    await deploymentService.initialize();
    console.log('✅ Deployment Service initialized');
  } catch (error) {
    console.log('⚠️ Deployment Service initialization skipped:', error.message);
  }

  // Initialize Feature Flag Service
  try {
    const featureFlagService = require('./src/services/featureFlagService');
    featureFlagService.initialize();
    console.log('✅ Feature Flag Service initialized');
  } catch (error) {
    console.log('⚠️ Feature Flag Service initialization skipped:', error.message);
  }

  } catch (error) {
    console.error('❌ Critical error during service initialization:', error.message);
  }
})();

// ─── GRACEFUL SHUTDOWN ──────────────────────────────────────────────────────
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    console.log('✅ HTTP server closed');
  });

  // Disconnect Socket.IO
  try {
    const { getIO } = require('./src/config/socket');
    const io = getIO();
    io.close(() => {
      console.log('✅ Socket.IO server closed');
    });
  } catch (_) {}

  // Disconnect Redis
  try {
    const { connectRedis } = require('./src/config/redis');
    if (connectRedis && typeof connectRedis.quit === 'function') {
      await connectRedis.quit();
    }
  } catch (_) {}

  // Force exit after timeout
  setTimeout(() => {
    console.error('⚠️ Forced shutdown after 10s timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
  console.error('⚠️ Continuing to run after uncaughtException (handler now catches via try/catch)');
});

// ─── START SERVER ───────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || 5000, 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

const startServer = (port) => {
  try {
    server.listen(port, () => {
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`  🦁 ARVIND PARTY BACKEND`);
      console.log(`  🌍 Environment : ${NODE_ENV}`);
      console.log(`  🚀 Port        : ${port}`);
      console.log(`  📡 Socket.IO   : enabled`);
      console.log(`  🌐 URL         : http://localhost:${port}`);
      console.log(`  ❤️  Health      : http://localhost:${port}/health`);
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        const fallbackPort = port + 1;
        console.warn(`⚠️ Port ${port} is already in use. Trying ${fallbackPort}...`);
        server.close(() => startServer(fallbackPort));
      } else {
        console.error('❌ Server error:', error);
      }
    });
  } catch (error) {
    console.error('❌ FATAL: Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer(PORT);