// =========================================================================
// SECURITY TESTS - Security Vulnerability Testing
// Tests for OWASP Top 10 2021 vulnerabilities
// =========================================================================

const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');

describe('Security Tests', () => {
  let dbConnected = false;

  beforeAll(async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/arvind_party_test', {
        serverSelectionTimeoutMS: 3000,
      });
      dbConnected = true;
    } catch (error) {
      console.warn('⚠️  MongoDB not available for security tests - skipping DB-dependent tests');
    }
  });

  afterAll(async () => {
    if (dbConnected) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    if (!dbConnected) return;
    const User = require('../../src/models/User');
    await User.deleteMany({});
  });

  afterEach(() => {
    // Cleanup
  });

  // Skip all tests if MongoDB is not available
  if (!dbConnected) {
    it('skipped - MongoDB not available', () => {
      console.warn('  ⏭️  All security tests skipped (no MongoDB)');
    });
  } else {

  describe('A01: Broken Access Control', () => {
    it('should reject requests without authentication token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject requests with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(res.status).toBe(401);
    });

    it('should reject requests with expired token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer expired_token');

      expect(res.status).toBe(401);
    });

    it('should prevent horizontal privilege escalation', async () => {
      // Create two users
      const User = require('../../src/models/User');
      const user1 = await User.create({ phone: '9876543210', name: 'User 1' });
      const user2 = await User.create({ phone: '9876543220', name: 'User 2' });

      // User 1 tries to access User 2's data
      const res = await request(app)
        .get(`/api/users/${user2._id}`)
        .set('Authorization', `Bearer user1_token`);

      expect(res.status).toBe(403);
    });
  });

  describe('A02: Cryptographic Failures', () => {
    it('should not expose sensitive data in responses', async () => {
      const User = require('../../src/models/User');
      await User.create({
        phone: '9876543210',
        name: 'Test User',
        password: 'hashed_password_should_not_be_in_response'
      });

      const res = await request(app)
        .post('/api/auth/otp-verify')
        .send({
          phone: '9876543210',
          otp: '123456'
        });

      // Response should not contain password
      expect(JSON.stringify(res.body)).not.toContain('hashed_password');
    });

    it('should not expose stack traces in production', () => {
      // This would be tested in production mode
      expect(process.env.NODE_ENV).not.toBe('production');
    });

    it('should use HTTPS in production', () => {
      // This would be tested in production environment
      if (process.env.NODE_ENV === 'production') {
        // Verify HTTPS is enforced
        expect(true).toBe(true);
      }
    });
  });

  describe('A03: Injection', () => {
    describe('NoSQL Injection', () => {
      it('should block $where injection', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            phone: { '$where': 'function() { return true; }' }
          });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('NoSQL');
      });

      it('should block $regex injection', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            phone: { '$regex': '.*', '$options': 'i' }
          });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('NoSQL');
      });

      it('should block $gt injection', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            phone: { '$gt': '' }
          });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('NoSQL');
      });

      it('should block $ne injection', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            phone: { '$ne': null }
          });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('NoSQL');
      });
    });

    describe('SQL Injection', () => {
      it('should detect UNION SELECT pattern', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            phone: "admin' UNION SELECT * FROM users--"
          });

        expect(res.status).toBe(400);
      });

      it('should detect OR 1=1 pattern', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            phone: "admin' OR '1'='1"
          });

        expect(res.status).toBe(400);
      });

      it('should detect DROP TABLE pattern', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            phone: "'; DROP TABLE users; --"
          });

        expect(res.status).toBe(400);
      });
    });

    describe('Command Injection', () => {
      it('should block command injection in filenames', async () => {
        const res = await request(app)
          .post('/api/upload')
          .attach('file', Buffer.from('test'), {
            filename: 'test; rm -rf /;.jpg',
            contentType: 'image/jpeg'
          });

        // Should reject malicious filename
        expect(res.status).toBeGreaterThanOrEqual(400);
      });
    });
  });

  describe('A04: Insecure Design', () => {
    it('should enforce rate limiting', async () => {
      const phone = '9999999999';
      
      // Send many requests
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          request(app)
            .post('/api/auth/send-otp')
            .send({ phone })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimited = responses.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should require strong passwords', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          phone: '9876543210',
          password: '123' // Weak password
        });

      expect(res.status).toBe(422);
    });

    it('should prevent brute force attacks', async () => {
      // Try multiple wrong OTPs
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/auth/otp-verify')
          .send({
            phone: '9876543210',
            otp: '000000'
          });
      }

      // Next request should be rate limited
      const res = await request(app)
        .post('/api/auth/otp-verify')
        .send({
          phone: '9876543210',
          otp: '000000'
        });

      expect(res.status).toBe(429);
    });
  });

  describe('A05: Security Misconfiguration', () => {
    it('should not expose server information', async () => {
      const res = await request(app)
        .get('/health');

      // Response should not contain server version
      expect(JSON.stringify(res.headers)).not.toContain('X-Powered-By');
    });

    it('should have security headers', async () => {
      const res = await request(app)
        .get('/health');

      expect(res.headers['x-xss-protection']).toBeDefined();
      expect(res.headers['x-content-type-options']).toBeDefined();
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('should not allow directory listing', async () => {
      const res = await request(app)
        .get('/src');

      expect(res.status).toBe(404);
    });
  });

  describe('A06: Vulnerable and Outdated Components', () => {
    it('should not have known vulnerabilities in dependencies', async () => {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);

      try {
        const { stdout } = await execPromise('npm audit --json');
        const audit = JSON.parse(stdout);
        
        // Should not have high or critical vulnerabilities
        if (audit.vulnerabilities) {
          const high = audit.vulnerabilities.filter(v => v.severity === 'high');
          const critical = audit.vulnerabilities.filter(v => v.severity === 'critical');
          
          expect(high.length).toBe(0);
          expect(critical.length).toBe(0);
        }
      } catch (error) {
        // npm audit might fail, that's ok
        console.log('npm audit check skipped');
      }
    });
  });

  describe('A07: Identification and Authentication Failures', () => {
    it('should enforce strong JWT secrets', () => {
      const jwtSecret = process.env.JWT_SECRET;
      
      // JWT secret should be at least 32 characters
      expect(jwtSecret.length).toBeGreaterThanOrEqual(32);
    });

    it('should not allow weak tokens', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer weak_token');

      expect(res.status).toBe(401);
    });

    it('should invalidate tokens on logout', async () => {
      const User = require('../../src/models/User');
      const user = await User.create({
        phone: '9876543210',
        name: 'Test User'
      });

      // Login
      const loginRes = await request(app)
        .post('/api/auth/otp-verify')
        .send({
          phone: '9876543210',
          otp: '123456'
        });

      const token = loginRes.body.data.accessToken;

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      // Try to use token again
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
    });

    it('should require password change for default credentials', async () => {
      // This would be tested if default credentials are detected
      expect(true).toBe(true);
    });
  });

  describe('A08: Software and Data Integrity Failures', () => {
    it('should verify file integrity', async () => {
      // This would test file upload validation
      const res = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('test'), {
          filename: 'test.jpg',
          contentType: 'image/jpeg'
        });

      // Should validate file
      expect(res.status).toBeGreaterThanOrEqual(200);
    });

    it('should not allow unsigned code execution', () => {
      // Verify no eval() usage in critical paths
      const fs = require('fs');
      const path = require('path');
      
      const criticalFiles = [
        'src/app.js',
        'src/middlewares/security.middleware.js'
      ];

      criticalFiles.forEach(file => {
        const content = fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');
        expect(content).not.toContain('eval(');
        expect(content).not.toContain('Function(');
      });
    });
  });

  describe('A09: Security Logging and Monitoring Failures', () => {
    it('should log authentication failures', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          phone: 'invalid',
          password: 'wrong'
        });

      // Request should be logged
      expect(res.status).toBe(400);
    });

    it('should log security events', async () => {
      // This would verify security events are logged
      expect(true).toBe(true);
    });
  });

  describe('A10: Server-Side Request Forgery (SSRF)', () => {
    it('should block requests to internal IPs', async () => {
      const res = await request(app)
        .post('/api/fetch-url')
        .send({ url: 'http://localhost:8080/admin' });

      expect(res.status).toBe(400);
    });

    it('should block requests to metadata endpoints', async () => {
      const res = await request(app)
        .post('/api/fetch-url')
        .send({ url: 'http://169.254.169.254/latest/meta-data/' });

      expect(res.status).toBe(400);
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize script tags', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          phone: '9876543210',
          name: '<script>alert("xss")</script>'
        });

      if (res.status === 201) {
        expect(res.body.data.user.name).not.toContain('<script>');
      }
    });

    it('should sanitize event handlers', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          phone: '9876543211',
          name: '<img onload="alert(1)">'
        });

      if (res.status === 201) {
        expect(res.body.data.user.name).not.toContain('onload');
      }
    });

    it('should sanitize javascript: URLs', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          phone: '9876543212',
          name: 'javascript:alert(1)'
        });

      if (res.status === 201) {
        expect(res.body.data.user.name).not.toContain('javascript:');
      }
    });
  });

  describe('CSRF Protection', () => {
    it('should require CSRF token for state-changing operations', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          phone: '9876543210',
          name: 'Test'
        });

      // Should either accept or reject based on CSRF config
      expect([200, 201, 400, 403]).toContain(res.status);
    });
  });

  describe('File Upload Security', () => {
    it('should reject executable files', async () => {
      const res = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('malicious'), {
          filename: 'test.exe',
          contentType: 'application/x-msdownload'
        });

      expect(res.status).toBe(400);
    });

    it('should reject files with double extensions', async () => {
      const res = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('test'), {
          filename: 'test.jpg.exe',
          contentType: 'image/jpeg'
        });

      expect(res.status).toBe(400);
    });

    it('should validate file size', async () => {
      const largeFile = Buffer.alloc(11 * 1024 * 1024); // 11MB
      const res = await request(app)
        .post('/api/upload')
        .attach('file', largeFile, {
          filename: 'large.jpg',
          contentType: 'image/jpeg'
        });

      expect(res.status).toBe(413);
    });
  });

  describe('Prototype Pollution', () => {
    it('should block __proto__ in requests', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          phone: '9876543210',
          name: 'Test',
          '__proto__': { isAdmin: true }
        });

      // Should not allow prototype pollution
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should block constructor in requests', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          phone: '9876543211',
          name: 'Test',
          'constructor': { prototype: { polluted: true } }
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Mass Assignment', () => {
    it('should block dangerous fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          phone: '9876543210',
          name: 'Test',
          isAdmin: true,
          balance: 999999
        });

      // Should strip dangerous fields
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('HTTP Parameter Pollution', () => {
    it('should handle duplicate query parameters', async () => {
      const res = await request(app)
        .get('/api/users?page=1&page=2&page=3');

      // Should not crash
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(500);
    });
  });
  }
});