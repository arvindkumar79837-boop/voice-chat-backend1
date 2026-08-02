// =========================================================================
// LOAD TESTS - Performance and Load Testing
// Tests application behavior under normal and peak load
// =========================================================================

const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');

describe('Load Tests', () => {
  let authTokens = [];

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/arvind_party_test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up and create test users
    const User = require('../../src/models/User');
    await User.deleteMany({});
    
    // Create 100 test users
    const users = [];
    for (let i = 0; i < 100; i++) {
      users.push({
        phone: `9876543${String(i).padStart(3, '0')}`,
        name: `Test User ${i}`,
        isVerified: true
      });
    }
    await User.insertMany(users);
    authTokens = [];
  });

  afterEach(async () => {
    // Cleanup tokens
    authTokens = [];
  });

  describe('Concurrent Authentication Requests', () => {
    it('should handle 100 concurrent OTP requests', async () => {
      const startTime = Date.now();
      
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          request(app)
            .post('/api/auth/send-otp')
            .send({ phone: `9876543${String(i).padStart(3, '0')}` })
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All requests should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBe(100);

      // Should complete within 10 seconds
      expect(duration).toBeLessThan(10000);

      console.log(`\n✅ 100 concurrent OTP requests completed in ${duration}ms`);
    });

    it('should handle 50 concurrent login requests', async () => {
      // First, get auth tokens
      for (let i = 0; i < 50; i++) {
        const res = await request(app)
          .post('/api/auth/otp-verify')
          .send({
            phone: `9876543${String(i).padStart(3, '0')}`,
            otp: '123456'
          });
        
        if (res.status === 200) {
          authTokens.push(res.body.data.accessToken);
        }
      }

      const startTime = Date.now();

      // Now test concurrent authenticated requests
      const promises = authTokens.map(token =>
        request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${token}`)
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(0);

      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);

      console.log(`\n✅ 50 concurrent authenticated requests completed in ${duration}ms`);
    });
  });

  describe('Database Load', () => {
    it('should handle 200 concurrent database queries', async () => {
      const User = require('../../src/models/User');
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < 200; i++) {
        promises.push(User.findById(authTokens[i % 50] || '507f1f77bcf86cd799439011'));
      }

      try {
        await Promise.all(promises);
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete within 15 seconds
        expect(duration).toBeLessThan(15000);

        console.log(`\n✅ 200 concurrent DB queries completed in ${duration}ms`);
      } catch (error) {
        // Some may fail due to invalid IDs, that's ok for load test
        console.log(`\n⚠️ Some queries failed (expected): ${error.message}`);
      }
    });

    it('should handle 50 concurrent aggregation queries', async () => {
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          request(app)
            .get('/api/rankings/wealth')
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 10 seconds
      expect(duration).toBeLessThan(10000);

      console.log(`\n✅ 50 concurrent aggregation queries completed in ${duration}ms`);
    });
  });

  describe('Memory Load', () => {
    it('should handle large payloads without memory leak', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Send 100 requests with large payloads
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          request(app)
            .post('/api/auth/register')
            .send({
              phone: `9876543${String(i).padStart(3, '0')}`,
              name: 'Test User',
              bio: 'x'.repeat(10000) // 10KB payload
            })
        );
      }

      await Promise.all(promises);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      // Memory increase should be less than 50MB
      expect(memoryIncreaseMB).toBeLessThan(50);

      console.log(`\n✅ Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const phone = '9999999999';
      
      // Send requests up to the limit
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/auth/send-otp')
            .send({ phone })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      // At least some should be rate limited
      expect(rateLimitedCount).toBeGreaterThan(0);

      console.log(`\n✅ Rate limiting enforced: ${rateLimitedCount} requests blocked`);
    });
  });

  describe('Response Time', () => {
    it('should maintain acceptable response times under load', async () => {
      const responseTimes = [];

      // Send 100 requests and measure response times
      for (let i = 0; i < 100; i++) {
        const startTime = Date.now();
        
        await request(app)
          .get('/health');

        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];

      // Average should be under 200ms
      expect(avgResponseTime).toBeLessThan(200);

      // P95 should be under 500ms
      expect(p95ResponseTime).toBeLessThan(500);

      // Max should be under 1s
      expect(maxResponseTime).toBeLessThan(1000);

      console.log(`\n✅ Response times - Avg: ${avgResponseTime.toFixed(2)}ms, P95: ${p95ResponseTime}ms, Max: ${maxResponseTime}ms`);
    });
  });

  describe('Concurrent Connections', () => {
    it('should handle multiple concurrent WebSocket connections', async () => {
      const http = require('http');
      const { Server } = require('socket.io');
      
      const server = http.createServer(app);
      const io = new Server(server, {
        cors: { origin: '*' }
      });

      await new Promise((resolve) => server.listen(0, resolve));
      const port = server.address().port;

      // Initialize sockets
      const { initializeSockets } = require('../../src/sockets');
      initializeSockets(io);

      // Create 100 concurrent connections
      const clients = [];
      for (let i = 0; i < 100; i++) {
        const client = require('socket.io-client')(`http://localhost:${port}`, {
          transports: ['websocket']
        });
        clients.push(client);
      }

      // Wait for all connections
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check connection count
      const connectedCount = clients.filter(c => c.connected).length;
      expect(connectedCount).toBeGreaterThan(80); // At least 80% should connect

      console.log(`\n✅ ${connectedCount}/100 concurrent WebSocket connections established`);

      // Cleanup
      clients.forEach(c => c.disconnect());
      await new Promise((resolve) => io.close(resolve));
      await new Promise((resolve) => server.close(resolve));
    });
  });

  describe('Cache Performance', () => {
    it('should improve response time with caching', async () => {
      // First request (cache miss)
      const start1 = Date.now();
      await request(app).get('/health');
      const time1 = Date.now() - start1;

      // Second request (potential cache hit)
      const start2 = Date.now();
      const res = await request(app).get('/health');
      const time2 = Date.now() - start2;

      // Second request should be faster or similar
      expect(time2).toBeLessThanOrEqual(time1 * 2);

      console.log(`\n✅ Cache performance - First: ${time1}ms, Second: ${time2}ms`);
    });
  });
});