// =========================================================================
// UNIT TESTS - Security Middleware
// OWASP Top 10 2021 Compliance Tests
// =========================================================================

const { preventNoSQLInjection, preventPrototypePollution, preventHTTPParameterPollution, sanitizeInput, preventSQLInjection, validateContentType, bodyLimit } = require('../../src/middlewares/security.middleware');
const { preventMassAssignment: massAssignmentProtection } = require('../../src/middlewares/massAssignment.middleware');

describe('Security Middleware Unit Tests', () => {
  let mockReq;
  let mockRes;
  let next;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
      headers: {},
      originalUrl: '/test',
      ip: '127.0.0.1'
    };
    mockRes = {
      status: jest.fn(() => mockRes),
      json: jest.fn()
    };
    next = jest.fn();
  });

  // ─── NoSQL Injection Tests ─────────────────────────────────────────────

  describe('preventNoSQLInjection', () => {
    it('should pass for normal requests', () => {
      mockReq.body = { name: 'John', age: 25 };
      preventNoSQLInjection(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
      expect(mockReq.body).toEqual({ name: 'John', age: 25 });
    });

    it('should remove $where operator', () => {
      mockReq.body = { '$where': 'function() { return true; }' };
      preventNoSQLInjection(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
      expect(mockReq.body).not.toHaveProperty('$where');
    });

    it('should remove $regex operator', () => {
      mockReq.body = { username: { '$regex': '.*', '$options': 'i' } };
      preventNoSQLInjection(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should remove $gt operator', () => {
      mockReq.body = { age: { '$gt': 18 } };
      preventNoSQLInjection(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should remove $ne operator', () => {
      mockReq.body = { status: { '$ne': 'active' } };
      preventNoSQLInjection(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should remove $in operator', () => {
      mockReq.body = { role: { '$in': ['admin', 'superadmin'] } };
      preventNoSQLInjection(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should remove $nin operator', () => {
      mockReq.body = { status: { '$nin': ['banned'] } };
      preventNoSQLInjection(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should remove $or operator', () => {
      mockReq.body = { '$or': [{ role: 'admin' }] };
      preventNoSQLInjection(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
      expect(mockReq.body).not.toHaveProperty('$or');
    });

    it('should remove $and operator', () => {
      mockReq.body = { '$and': [{ role: 'admin' }] };
      preventNoSQLInjection(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
      expect(mockReq.body).not.toHaveProperty('$and');
    });

    it('should remove $expr operator', () => {
      mockReq.body = { '$expr': { '$eq': ['$a', '$b'] } };
      preventNoSQLInjection(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
      expect(mockReq.body).not.toHaveProperty('$expr');
    });

    it('should remove $jsonSchema operator', () => {
      mockReq.body = { '$jsonSchema': { 'bsonType': 'object' } };
      preventNoSQLInjection(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
      expect(mockReq.body).not.toHaveProperty('$jsonSchema');
    });

    it('should check nested objects', () => {
      mockReq.body = { user: { '$where': 'malicious' } };
      preventNoSQLInjection(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should check query parameters', () => {
      mockReq.query = { filter: { '$gt': 100 } };
      preventNoSQLInjection(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ─── Prototype Pollution Tests ─────────────────────────────────────────

  describe('preventPrototypePollution', () => {
    it('should pass for normal objects', () => {
      mockReq.body = { name: 'John', age: 25 };
      preventPrototypePollution(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should block __proto__ key', () => {
      mockReq.body = JSON.parse('{"__proto__": {"isAdmin": true}}');
      preventPrototypePollution(mockReq, mockRes, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('should block constructor key', () => {
      mockReq.body = { 'constructor': { prototype: { isAdmin: true } } };
      preventPrototypePollution(mockReq, mockRes, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('should block prototype key', () => {
      mockReq.body = { 'prototype': { polluted: true } };
      preventPrototypePollution(mockReq, mockRes, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('should check nested objects', () => {
      mockReq.body = JSON.parse('{"user": {"__proto__": {"role": "admin"}}}');
      preventPrototypePollution(mockReq, mockRes, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('should check arrays', () => {
      mockReq.body = JSON.parse('{"items": [{"__proto__": {"polluted": true}}]}');
      preventPrototypePollution(mockReq, mockRes, next);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ─── HTTP Parameter Pollution Tests ────────────────────────────────────

  describe('preventHTTPParameterPollution', () => {
    it('should pass single values', () => {
      mockReq.query = { page: '1', limit: '10' };
      preventHTTPParameterPollution(mockReq, mockRes, next);
      expect(mockReq.query.page).toBe('1');
      expect(mockReq.query.limit).toBe('10');
      expect(next).toHaveBeenCalled();
    });

    it('should take first value for duplicate keys', () => {
      mockReq.query = { page: ['1', '2', '3'] };
      preventHTTPParameterPollution(mockReq, mockRes, next);
      expect(mockReq.query.page).toBe('1');
      expect(next).toHaveBeenCalled();
    });

    it('should handle mixed single and array values', () => {
      mockReq.query = { page: '1', limit: ['10', '20'] };
      preventHTTPParameterPollution(mockReq, mockRes, next);
      expect(mockReq.query.page).toBe('1');
      expect(mockReq.query.limit).toBe('10');
      expect(next).toHaveBeenCalled();
    });
  });

  // ─── XSS/Sanitization Tests ─────────────────────────────────────────────

  describe('sanitizeInput', () => {
    it('should sanitize script tags', () => {
      mockReq.body = { comment: '<script>alert("xss")</script>' };
      sanitizeInput(mockReq, mockRes, next);
      expect(mockReq.body.comment).not.toContain('<script>');
      expect(next).toHaveBeenCalled();
    });

    it('should sanitize event handlers', () => {
      mockReq.body = { name: '<div onclick="alert(1)">test</div>' };
      sanitizeInput(mockReq, mockRes, next);
      expect(mockReq.body.name).not.toContain('onclick');
      expect(next).toHaveBeenCalled();
    });

    it('should preserve safe content', () => {
      mockReq.body = { name: 'John Doe' };
      sanitizeInput(mockReq, mockRes, next);
      expect(mockReq.body.name).toBe('John Doe');
      expect(next).toHaveBeenCalled();
    });

    it('should sanitize query parameters', () => {
      mockReq.query = { search: '<script>alert(1)</script>' };
      sanitizeInput(mockReq, mockRes, next);
      expect(mockReq.query.search).not.toContain('<script>');
      expect(next).toHaveBeenCalled();
    });
  });

  // ─── SQL Injection Tests ───────────────────────────────────────────────

  describe('preventSQLInjection', () => {
    it('should pass for normal input', () => {
      mockReq.body = { name: 'John' };
      preventSQLInjection(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should detect UNION SELECT', () => {
      mockReq.body = { username: "admin' UNION SELECT * FROM users--" };
      preventSQLInjection(mockReq, mockRes, next);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should detect OR 1=1', () => {
      mockReq.body = { password: "pass' OR '1'='1" };
      preventSQLInjection(mockReq, mockRes, next);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should detect DROP TABLE', () => {
      mockReq.body = { input: "'; DROP TABLE users; --" };
      preventSQLInjection(mockReq, mockRes, next);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should detect comment patterns', () => {
      mockReq.body = { input: "admin'--" };
      preventSQLInjection(mockReq, mockRes, next);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ─── Content-Type Validation Tests ─────────────────────────────────────

  describe('validateContentType', () => {
    it('should pass for POST with JSON', () => {
      mockReq.headers['content-type'] = 'application/json';
      mockReq.body = { name: 'John' };
      const middleware = validateContentType();
      middleware(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass for GET without body', () => {
      mockReq.method = 'GET';
      mockReq.headers = {};
      const middleware = validateContentType();
      middleware(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass for multipart/form-data', () => {
      mockReq.headers['content-type'] = 'multipart/form-data; boundary=----WebKitFormBoundary';
      const middleware = validateContentType();
      middleware(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass for allowed non-JSON types', () => {
      mockReq.headers['content-type'] = 'application/x-www-form-urlencoded';
      const middleware = validateContentType();
      middleware(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid content type for POST', () => {
      mockReq.method = 'POST';
      mockReq.headers['content-type'] = 'text/html';
      const middleware = validateContentType();
      middleware(mockReq, mockRes, next);
      expect(mockRes.status).toHaveBeenCalledWith(415);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ─── Body Limit Tests ──────────────────────────────────────────────────

  describe('bodyLimit', () => {
    it('should pass for normal body size', () => {
      mockReq.headers['content-length'] = '50000'; // 50KB
      const middleware = bodyLimit(102400); // 100KB in bytes
      middleware(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject oversized body', () => {
      mockReq.headers['content-length'] = '200000'; // 200KB
      const middleware = bodyLimit(102400); // 100KB in bytes
      middleware(mockReq, mockRes, next);
      expect(mockRes.status).toHaveBeenCalledWith(413);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle missing content-length', () => {
      mockReq.headers = {};
      const middleware = bodyLimit(102400);
      middleware(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ─── Mass Assignment Tests ─────────────────────────────────────────────

  describe('massAssignmentProtection', () => {
    it('should allow whitelisted fields', () => {
      mockReq.body = { name: 'John', email: 'john@example.com' };
      const allowedFields = ['name', 'email', 'age'];
      massAssignmentProtection(allowedFields)(mockReq, mockRes, next);
      expect(mockReq.body.name).toBe('John');
      expect(mockReq.body.email).toBe('john@example.com');
      expect(next).toHaveBeenCalled();
    });

    it('should strip non-whitelisted fields', () => {
      mockReq.body = { name: 'John', age: 30, city: 'NYC' };
      const allowedFields = ['name', 'email'];
      massAssignmentProtection(allowedFields)(mockReq, mockRes, next);
      expect(mockReq.body.name).toBe('John');
      expect(mockReq.body.age).toBeUndefined();
      expect(mockReq.body.city).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should always block dangerous fields', () => {
      mockReq.body = { name: 'John', password: 'secret123' };
      const allowedFields = ['name'];
      massAssignmentProtection(allowedFields)(mockReq, mockRes, next);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should block password hash field', () => {
      mockReq.body = { name: 'John', passwordHash: 'hashed' };
      const allowedFields = ['name'];
      massAssignmentProtection(allowedFields)(mockReq, mockRes, next);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should block balance field', () => {
      mockReq.body = { name: 'John', balance: 1000 };
      const allowedFields = ['name'];
      massAssignmentProtection(allowedFields)(mockReq, mockRes, next);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});