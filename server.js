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
const { connectRedis } = require('./src/config/redis');
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

  // Initialize Redis for ranking service
  try {
    await connectRedis();
  } catch (error) {
    console.log('⚠️ Ranking Redis Connection Error - Rankings will use MongoDB fallback');
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
    await powerMatrixController.initializePowerMatrix();
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

  // Initialize Auto Scaling Service
  try {
    const autoScalingService = require('./src/services/autoScalingService');
    autoScalingService.setIo(io);
    autoScalingService.start();
    console.log('✅ Auto Scaling Service initialized');
  } catch (error) {
    console.log('⚠️ Auto Scaling Service initialization skipped:', error.message);
  }

  // Initialize Backup Service
  try {
    const backupService = require('./src/services/backupService');
    await backupService.initialize();
    console.log('✅ Backup Service initialized');
  } catch (error) {
    console.log('⚠️ Backup Service initialization skipped:', error.message);
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
})();

// ─── SETUP HTTP + SOCKET.IO ────────────────────────────────────────────────
const server = http.createServer(app);
const io = initializeSocket(server);

// Make `io` accessible globally inside controllers
app.set('io', io);

// ─── SETUP SOCKET HANDLERS ─────────────────────────────────────────────────
const { initializeSockets } = require('./src/sockets');

initializeSockets(io);



  // ─── START BACKGROUND WORKERS ────────────────────────────────────────────
  const GiftQueueWorker = require('./src/workers/giftQueueWorker');
  GiftQueueWorker.start();

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
const salaryInterval = setInterval(async () => {
  const now = new Date();
  if (now.getDate() === 1 && now.getHours() === 0 && now.getMinutes() === 0) {
    try {
      const Agency = require('./src/models/Agency');
      const SalaryRecord = require('./src/models/SalaryRecord');
      const agencies = await Agency.find({ isActive: true });
      for (const agency of agencies) {
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
  }
}, 60 * 1000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready`);
  console.log(`🌐 http://localhost:${PORT}`);
});
