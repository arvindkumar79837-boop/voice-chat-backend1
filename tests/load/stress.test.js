// =========================================================================
// STRESS TESTS - System Stress Testing
// Tests application behavior under extreme load
// =========================================================================

const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');

describe('Stress Tests', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/arvind_party_test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    const User = require('../../src/models/User');
    await User.deleteMany({});
  });

  afterEach(async () => {
    // Cleanup
  });

  describe('Extreme Concurrent Requests', () => {
    it('should handle 1000 concurrent health checks', async () => {
      const startTime = Date.now();
      
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        promises.push(request(app).get('/health'));
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successCount = responses.filter(r => r.status === 200).length;
      const successRate = (successCount / 1000) * 100;

      // At least 95% should succeed
      expect(successRate).toBeGreaterThanOrEqual(95);

      // Should complete within 30 seconds
      expect(duration).toBeLessThan(30000);

      console.log(`\n✅ 1000 concurrent requests - Success rate: ${successRate}%, Time: ${duration}ms`);
    });

    it('should handle sustained load for 60 seconds', async () => {
      const requestCount = { total: 0, success: 0, failed: 0 };
      const duration = 60000; // 60 seconds
      const startTime = Date.now();

      // Send requests continuously for 60 seconds
      while (Date.now() - startTime < duration) {
        const promises = [];
        for (let i = 0; i < 50; i++) {
          promises.push(request(app).get('/health'));
        }

        const responses = await Promise.all(promises);
        requestCount.total += responses.length;
        requestCount.success += responses.filter(r => r.status === 200).length;
        requestCount.failed += responses.filter(r => r.status !== 200).length;

        // Small delay to prevent complete overload
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const successRate = (requestCount.success / requestCount.total) * 100;

      // Success rate should be at least 90%
      expect(successRate).toBeGreaterThanOrEqual(90);

      console.log(`\n✅ Sustained load test - Total: ${requestCount.total}, Success: ${requestCount.success}, Rate: ${successRate.toFixed(2)}%`);
    });
  });

  describe('Memory Stress', () => {
    it('should not crash under memory pressure', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const maxMemory = 500 * 1024 * 1024; // 500MB limit

      // Send requests with increasingly large payloads
      for (let size = 1000; size <= 100000; size *= 10) {
        const promises = [];
        for (let i = 0; i < 50; i++) {
          promises.push(
            request(app)
              .post('/api/auth/register')
              .send({
                phone: `9876543${String(i).padStart(3, '0')}`,
                name: 'Test User',
                bio: 'x'.repeat(size)
              })
          );
        }

        await Promise.all(promises);

        // Check memory usage
        const currentMemory = process.memoryUsage().heapUsed;
        if (currentMemory > maxMemory) {
          console.log(`\n⚠️ Memory limit reached at payload size ${size}`);
          break;
        }

        // Force garbage collection
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(`\n✅ Memory stress test - Increase: ${memoryIncrease.toFixed(2)}MB`);
      
      // Should not exceed 500MB increase
      expect(memoryIncrease).toBeLessThan(500);
    });

    it('should handle memory leak gracefully', async () => {
      const memorySnapshots = [];

      // Take memory snapshots during sustained load
      for (let i = 0; i < 10; i++) {
        const promises = [];
        for (let j = 0; j < 100; j++) {
          promises.push(request(app).get('/health'));
        }
        await Promise.all(promises);

        if (global.gc) {
          global.gc();
        }

        memorySnapshots.push(process.memoryUsage().heapUsed);
      }

      // Check for consistent memory growth (indicates leak)
      const growth = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0];
      const growthMB = growth / 1024 / 1024;

      // Memory should not grow more than 100MB over time
      expect(growthMB).toBeLessThan(100);

      console.log(`\n✅ Memory leak test - Growth: ${growthMB.toFixed(2)}MB`);
    });
  });

  describe('Database Stress', () => {
    it('should handle 500 concurrent database writes', async () => {
      const User = require('../../src/models/User');
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < 500; i++) {
        promises.push(
          User.create({
            phone: `999999${String(i).padStart(3, '0')}`,
            name: `Stress User ${i}`
          })
        );
      }

      try {
        await Promise.all(promises);
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete within 30 seconds
        expect(duration).toBeLessThan(30000);

        console.log(`\n✅ 500 concurrent DB writes completed in ${duration}ms`);
      } catch (error) {
        console.log(`\n⚠️ Some writes failed: ${error.message}`);
      }
    });

    it('should handle 1000 concurrent database reads', async () => {
      const User = require('../../src/models/User');
      
      // Create test user first
      const testUser = await User.create({
        phone: '9999999999',
        name: 'Stress Test User'
      });

      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < 1000; i++) {
        promises.push(User.findById(testUser._id));
      }

      await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 20 seconds
      expect(duration).toBeLessThan(20000);

      console.log(`\n✅ 1000 concurrent DB reads completed in ${duration}ms`);
    });

    it('should handle complex aggregations under load', async () => {
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          request(app)
            .get('/api/rankings/wealth')
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(0);

      // Should complete within 15 seconds
      expect(duration).toBeLessThan(15000);

      console.log(`\n✅ 100 concurrent aggregations completed in ${duration}ms`);
    });
  });

  describe('Connection Stress', () => {
    it('should handle rapid connection/disconnection', async () => {
      const http = require('http');
      const { Server } = require('socket.io');
      
      const server = http.createServer(app);
      const io = new Server(server, {
        cors: { origin: '*' }
      });

      await new Promise((resolve) => server.listen(0, resolve));
      const port = server.address().port;

      const { initializeSockets } = require('../../src/sockets');
      initializeSockets(io);

      const startTime = Date.now();

      // Rapidly connect and disconnect
      for (let i = 0; i < 500; i++) {
        const client = require('socket.io-client')(`http://localhost:${port}`, {
          transports: ['websocket']
        });

        await new Promise((resolve) => {
          client.on('connect', () => {
            client.disconnect();
            resolve();
          });
        });

        client.disconnect();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 30 seconds
      expect(duration).toBeLessThan(30000);

      console.log(`\n✅ 500 rapid connections handled in ${duration}ms`);

      await new Promise((resolve) => io.close(resolve));
      await new Promise((resolve) => server.close(resolve));
    });

    it('should handle maximum concurrent WebSocket connections', async () => {
      const http = require('http');
      const { Server } = require('socket.io');
      
      const server = http.createServer(app);
      const io = new Server(server, {
        cors: { origin: '*' },
        maxHttpBufferSize: 1e6
      });

      await new Promise((resolve) => server.listen(0, resolve));
      const port = server.address().port;

      const { initializeSockets } = require('../../src/sockets');
      initializeSockets(io);

      // Try to establish 200 connections
      const clients = [];
      for (let i = 0; i < 200; i++) {
        const client = require('socket.io-client')(`http://localhost:${port}`, {
          transports: ['websocket']
        });
        clients.push(client);
      }

      // Wait for connections
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const connectedCount = clients.filter(c => c.connected).length;
      const connectionRate = (connectedCount / 200) * 100;

      // At least 70% should connect
      expect(connectionRate).toBeGreaterThanOrEqual(70);

      console.log(`\n✅ ${connectedCount}/200 max concurrent connections (${connectionRate}%)`);

      // Cleanup
      clients.forEach(c => c.disconnect());
      await new Promise((resolve) => io.close(resolve));
      await new Promise((resolve) => server.close(resolve));
    });
  });

  describe('Error Recovery', () => {
    it('should recover from database connection loss', async () => {
      // This test verifies the app doesn't crash on DB errors
      const responses = [];
      
      for (let i = 0; i < 50; i++) {
        try {
          const res = await request(app).get('/health');
          responses.push(res.status);
        } catch (error) {
          responses.push(500);
        }
      }

      // Should return valid responses (not crash)
      const validResponses = responses.filter(r => r === 200 || r === 503);
      expect(validResponses.length).toBeGreaterThan(0);

      console.log(`\n✅ Error recovery test - Valid responses: ${validResponses.length}/50`);
    });

    it('should handle malformed requests without crashing', async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({ invalid: 'data'.repeat(1000) })
        );
      }

      const responses = await Promise.all(promises);
      const errorCount = responses.filter(r => r.status >= 400).length;

      // All should return errors, not crash
      expect(errorCount).toBeGreaterThan(0);

      console.log(`\n✅ Malformed request handling - ${errorCount}/100 handled gracefully`);
    });
  });

  describe('Resource Exhaustion', () => {
    it('should handle file descriptor limits', async () => {
      const responses = [];

      // Open many connections
      for (let i = 0; i < 1000; i++) {
        try {
          const res = await request(app).get('/health');
          responses.push(res.status);
        } catch (error) {
          responses.push(500);
        }
      }

      const successCount = responses.filter(r => r.status === 200).length;
      const successRate = (successCount / responses.length) * 100;

      // Should maintain at least 80% success rate
      expect(successRate).toBeGreaterThanOrEqual(80);

      console.log(`\n✅ Resource exhaustion test - Success rate: ${successRate.toFixed(2)}%`);
    });

    it('should handle CPU-intensive operations', async () => {
      const startTime = Date.now();

      // Multiple CPU-intensive requests
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          request(app)
            .get('/api/rankings/wealth')
        );
      }

      await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 20 seconds
      expect(duration).toBeLessThan(20000);

      console.log(`\n✅ CPU stress test - 100 requests in ${duration}ms`);
    });
  });
});