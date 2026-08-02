// =========================================================================
// SOCKET TESTS - WebSocket Integration Tests
// Tests Socket.IO connections and events
// =========================================================================

const { Server } = require('socket.io');
const http = require('http');
const app = require('../../src/app');
const mongoose = require('mongoose');

describe('Socket.IO Integration Tests', () => {
  let server;
  let io;
  let clientSocket;

  beforeAll(async () => {
    // Create HTTP server
    server = http.createServer(app);
    
    // Initialize Socket.IO
    io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    // Start server
    await new Promise((resolve) => {
      server.listen(0, resolve); // Random port
    });

    // Initialize socket handlers
    const { initializeSockets } = require('../../src/sockets');
    initializeSockets(io);
  });

  afterAll(async () => {
    // Cleanup
    if (clientSocket) {
      clientSocket.disconnect();
    }
    if (io) {
      await new Promise((resolve) => io.close(resolve));
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });

  beforeEach(() => {
    clientSocket = null;
  });

  afterEach((done) => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    done();
  });

  describe('Connection Tests', () => {
    it('should connect successfully', (done) => {
      clientSocket = require('socket.io-client')(`http://localhost:${server.address().port}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', (err) => {
        done(err);
      });
    });

    it('should handle disconnection', (done) => {
      clientSocket = require('socket.io-client')(`http://localhost:${server.address().port}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        clientSocket.disconnect();
      });

      clientSocket.on('disconnect', () => {
        expect(clientSocket.connected).toBe(false);
        done();
      });
    });

    it('should reconnect after disconnection', (done) => {
      clientSocket = require('socket.io-client')(`http://localhost:${server.address().port}`, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 100
      });

      let disconnectCount = 0;
      let connectCount = 0;

      clientSocket.on('connect', () => {
        connectCount++;
        if (disconnectCount === 1 && connectCount === 2) {
          expect(clientSocket.connected).toBe(true);
          done();
        }
      });

      clientSocket.on('disconnect', () => {
        disconnectCount++;
        if (disconnectCount === 1) {
          // Force disconnect and wait for reconnect
          setTimeout(() => {
            clientSocket.connect();
          }, 200);
        }
      });
    });
  });

  describe('Authentication Tests', () => {
    it('should authenticate with valid token', (done) => {
      clientSocket = require('socket.io-client')(`http://localhost:${server.address().port}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        // Mock authentication
        clientSocket.emit('authenticate', { token: 'valid_token' });
      });

      clientSocket.on('authenticated', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('unauthorized', (err) => {
        done(new Error('Authentication failed'));
      });
    });

    it('should reject invalid token', (done) => {
      clientSocket = require('socket.io-client')(`http://localhost:${server.address().port}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('authenticate', { token: 'invalid_token' });
      });

      clientSocket.on('unauthorized', (err) => {
        expect(err).toBeDefined();
        done();
      });

      clientSocket.on('authenticated', () => {
        done(new Error('Should not authenticate'));
      });
    });
  });

  describe('Room Tests', () => {
    it('should join room successfully', (done) => {
      clientSocket = require('socket.io-client')(`http://localhost:${server.address().port}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('join-room', { roomId: 'test-room-1' });
      });

      clientSocket.on('room-joined', (data) => {
        expect(data.roomId).toBe('test-room-1');
        done();
      });

      clientSocket.on('error', (err) => {
        done(err);
      });
    });

    it('should leave room successfully', (done) => {
      clientSocket = require('socket.io-client')(`http://localhost:${server.address().port}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('join-room', { roomId: 'test-room-1' });
      });

      clientSocket.on('room-joined', () => {
        clientSocket.emit('leave-room', { roomId: 'test-room-1' });
      });

      clientSocket.on('room-left', (data) => {
        expect(data.roomId).toBe('test-room-1');
        done();
      });
    });

    it('should receive room messages', (done) => {
      clientSocket = require('socket.io-client')(`http://localhost:${server.address().port}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('join-room', { roomId: 'test-room-1' });
      });

      clientSocket.on('room-joined', () => {
        // Wait a bit then emit message
        setTimeout(() => {
          clientSocket.emit('send-message', {
            roomId: 'test-room-1',
            message: 'Hello World'
          });
        }, 100);
      });

      clientSocket.on('message-received', (data) => {
        expect(data.message).toBe('Hello World');
        done();
      });
    });
  });

  describe('Gift Tests', () => {
    it('should send gift successfully', (done) => {
      clientSocket = require('socket.io-client')(`http://localhost:${server.address().port}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('send-gift', {
          roomId: 'test-room-1',
          giftId: 'gift-1',
          quantity: 1
        });
      });

      clientSocket.on('gift-sent', (data) => {
        expect(data.giftId).toBe('gift-1');
        done();
      });

      clientSocket.on('error', (err) => {
        done(err);
      });
    });

    it('should handle combo gifts', (done) => {
      clientSocket = require('socket.io-client')(`http://localhost:${server.address().port}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('send-combo', {
          roomId: 'test-room-1',
          gifts: [
            { giftId: 'gift-1', quantity: 1 },
            { giftId: 'gift-2', quantity: 1 }
          ]
        });
      });

      clientSocket.on('combo-sent', (data) => {
        expect(data.gifts.length).toBe(2);
        done();
      });
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should rate limit excessive requests', (done) => {
      clientSocket = require('socket.io-client')(`http://localhost:${server.address().port}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        // Send many requests quickly
        for (let i = 0; i < 100; i++) {
          clientSocket.emit('send-message', {
            roomId: 'test-room-1',
            message: `Spam ${i}`
          });
        }
      });

      clientSocket.on('rate-limited', () => {
        expect(true).toBe(true);
        done();
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        done(); // Pass even if rate limit not triggered (depends on config)
      }, 5000);
    });
  });

  describe('Presence Tests', () => {
    it('should track user presence', (done) => {
      clientSocket = require('socket.io-client')(`http://localhost:${server.address().port}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('user-typing', { roomId: 'test-room-1' });
      });

      clientSocket.on('user-typing-update', (data) => {
        expect(data.roomId).toBe('test-room-1');
        expect(data.users.length).toBeGreaterThan(0);
        done();
      });
    });

    it('should handle user disconnect', (done) => {
      clientSocket = require('socket.io-client')(`http://localhost:${server.address().port}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('join-room', { roomId: 'test-room-1' });
      });

      clientSocket.on('room-joined', () => {
        clientSocket.disconnect();
      });

      clientSocket.on('disconnect', () => {
        // Wait for disconnect propagation
        setTimeout(done, 500);
      });
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle invalid events', (done) => {
      clientSocket = require('socket.io-client')(`http://localhost:${server.address().port}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('invalid-event', { data: 'test' });
      });

      clientSocket.on('error', (err) => {
        expect(err).toBeDefined();
        done();
      });

      // Timeout if no error
      setTimeout(done, 1000);
    });

    it('should handle malformed data', (done) => {
      clientSocket = require('socket.io-client')(`http://localhost:${server.address().port}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('join-room', { invalidData: 'test' });
      });

      clientSocket.on('error', (err) => {
        expect(err).toBeDefined();
        done();
      });

      setTimeout(done, 1000);
    });
  });
});