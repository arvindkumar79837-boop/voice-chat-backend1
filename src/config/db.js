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
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    MonitoringService.updateDatabaseStatus(true);
    setupConnectionHandlers();
    return true;
  } catch (error) {
    console.error(`⚠️ MongoDB Connection Error: ${error.message}`);
    console.log('⚠️ Server will continue running without database (using fallback data)');
    return false;
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
    console.error(`⚠️ MongoDB Runtime Error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    MonitoringService.updateDatabaseStatus(false);
    console.warn('⚠️ MongoDB Disconnected. Attempting reconnect with backoff...');
    reconnectWithBackoff();
  });

  mongoose.connection.on('reconnected', () => {
    MonitoringService.updateDatabaseStatus(true);
    console.log('🔄 MongoDB Reconnected');
  });

  mongoose.connection.on('close', () => {
    MonitoringService.updateDatabaseStatus(false);
    console.log('✅ MongoDB Connection Closed');
  });


  // Graceful shutdown
  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('📴 MongoDB Connection Closed via App Termination');
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
      console.log(`✅ MongoDB Reconnected: ${conn.connection.host}`);
      return true;
    } catch (error) {
      const waitTime = delay * Math.pow(2, i);
      console.warn(`⚠️ Reconnect attempt ${i + 1} failed. Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  console.error('❌ MongoDB Reconnection Failed after maximum retries. Server running without DB.');
  return false;
};

module.exports = connectDB;
