// =========================================================================
// INTEGRATION TESTS - Authentication Flow
// Tests complete authentication workflows
// =========================================================================

const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');
const User = require('../../src/models/User');

describe('Authentication Integration Tests', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/arvind_party_test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up users before each test
    await User.deleteMany({});
    testUser = null;
    authToken = null;
  });

  describe('POST /api/auth/send-otp', () => {
    it('should send OTP to valid phone number', async () => {
      const res = await request(app)
        .post('/api/auth/send-otp')
        .send({ phone: '9876543210' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('OTP');
    });

    it('should reject invalid phone number', async () => {
      const res = await request(app)
        .post('/api/auth/send-otp')
        .send({ phone: '123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should rate limit after 5 requests', async () => {
      const promises = [];
      for (let i = 0; i < 6; i++) {
        promises.push(
          request(app)
            .post('/api/auth/send-otp')
            .send({ phone: '9876543210' })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/auth/otp-verify', () => {
    beforeEach(async () => {
      // Create a test user first
      testUser = await User.create({
        phone: '9876543210',
        otp: '123456',
        otpExpires: Date.now() + 600000,
        isVerified: false
      });
    });

    it('should verify OTP and return tokens', async () => {
      const res = await request(app)
        .post('/api/auth/otp-verify')
        .send({
          phone: '9876543210',
          otp: '123456'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('should reject invalid OTP', async () => {
      const res = await request(app)
        .post('/api/auth/otp-verify')
        .send({
          phone: '9876543210',
          otp: '000000'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid');
    });

    it('should reject expired OTP', async () => {
      // Expire the OTP
      testUser.otpExpires = Date.now() - 1000;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/otp-verify')
        .send({
          phone: '9876543210',
          otp: '123456'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('expired');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new user with valid data', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          phone: '9876543210',
          name: 'Test User',
          email: 'test@example.com'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.name).toBe('Test User');
    });

    it('should reject duplicate phone number', async () => {
      // Create existing user
      await User.create({
        phone: '9876543210',
        name: 'Existing User'
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          phone: '9876543210',
          name: 'New User'
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('USER_ALREADY_EXISTS');
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          phone: '9876543210',
          email: 'invalid-email'
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/auth/me', () => {
    beforeEach(async () => {
      // Register and login user
      await User.create({
        phone: '9876543210',
        name: 'Test User',
        isVerified: true
      });

      const loginRes = await request(app)
        .post('/api/auth/otp-verify')
        .send({
          phone: '9876543210',
          otp: '123456'
        });

      authToken = loginRes.body.data.accessToken;
    });

    it('should return user profile with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Test User');
    });

    it('should reject request without token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    beforeEach(async () => {
      await User.create({
        phone: '9876543210',
        name: 'Test User',
        isVerified: true
      });

      const loginRes = await request(app)
        .post('/api/auth/otp-verify')
        .send({
          phone: '9876543210',
          otp: '123456'
        });

      authToken = loginRes.body.data.accessToken;
    });

    it('should logout successfully with valid token', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject logout without token', async () => {
      const res = await request(app)
        .post('/api/auth/logout');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    let refreshToken;

    beforeEach(async () => {
      await User.create({
        phone: '9876543210',
        name: 'Test User',
        isVerified: true
      });

      const loginRes = await request(app)
        .post('/api/auth/otp-verify')
        .send({
          phone: '9876543210',
          otp: '123456'
        });

      refreshToken = loginRes.body.data.refreshToken;
    });

    it('should refresh access token with valid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid_token' });

      expect(res.status).toBe(401);
    });
  });
});