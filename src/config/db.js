const Logger = require('../utils/logger');
const mongoose = require('mongoose');
const MonitoringService = require('../services/monitoringService');

// Suppress duplicate index warnings
mongoose.set('strictQuery', false);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/arvind_party', {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
    });
    Logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    MonitoringService.updateDatabaseStatus(true);
    setupConnectionHandlers();
    return true;
  } catch (error) {
    Logger.error(`⚠️ MongoDB Connection Error: ${error.message}`);
    Logger.error('❌ Database connection failed. Exiting to prevent data corruption.');
    process.exit(1);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// CONNECTION EVENT HANDLERS
// ─────────────────────────────────────────────────────────────────────────
const setupConnectionHandlers = () => {
  mongoose.connection.on('connected', () => {
    MonitoringService.updateDatabaseStatus(true);
  });

  mongoose.connection.on('error', (err) => {
    MonitoringService.updateDatabaseStatus(false);
    Logger.error(`⚠️ MongoDB Runtime Error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    MonitoringService.updateDatabaseStatus(false);
    Logger.warn('⚠️ MongoDB Disconnected. Attempting reconnect with backoff...');
    reconnectWithBackoff();
  });

  mongoose.connection.on('reconnected', () => {
    MonitoringService.updateDatabaseStatus(true);
    Logger.info('🔄 MongoDB Reconnected');
  });

  mongoose.connection.on('close', () => {
    MonitoringService.updateDatabaseStatus(false);
    Logger.info('✅ MongoDB Connection Closed');
  });


  // Graceful shutdown
  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    Logger.info('📴 MongoDB Connection Closed via App Termination');
    process.exit(0);
  });
};

// ─────────────────────────────────────────────────────────────────────────
// RECONNECT WITH EXPONENTIAL BACKOFF
// ─────────────────────────────────────────────────────────────────────────
const reconnectWithBackoff = async (retries = 5, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/arvind_party', {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 10,
        minPoolSize: 2,
        socketTimeoutMS: 45000,
        heartbeatFrequencyMS: 10000,
      });
      Logger.info(`✅ MongoDB Reconnected: ${conn.connection.host}`);
      return true;
    } catch (error) {
      const waitTime = delay * Math.pow(2, i);
      Logger.warn(`⚠️ Reconnect attempt ${i + 1} failed. Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  Logger.error('❌ MongoDB Reconnection Failed after maximum retries. Server running without DB.');
  return false;
};

module.exports = connectDB;
