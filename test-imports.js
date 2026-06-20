#!/usr/bin/env node
// Quick import test to verify all modules load correctly

console.log('🧪 Testing imports...\n');

try {
  console.log('✅ Importing dotenv...');
  require('dotenv').config();
  
  console.log('✅ Importing app.js...');
  const app = require('./src/app');
  
  console.log('✅ Importing server modules...');
  const http = require('http');
  const { initializeSocket } = require('./src/config/socket');
  const connectDB = require('./src/config/db');
  
  console.log('✅ All imports successful!');
  console.log('\n📊 Import Summary:');
  console.log('  - Express app: ✅');
  console.log('  - Socket.IO: ✅');
  console.log('  - Database config: ✅');
  console.log('  - All middlewares: ✅');
  console.log('  - All controllers: ✅');
  console.log('  - All routes: ✅');
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ Import Error:');
  console.error('File:', error.stack.split('\n')[1]);
  console.error('Message:', error.message);
  process.exit(1);
}
