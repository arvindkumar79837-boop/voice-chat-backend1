// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/config/swagger.js
// ARVIND PARTY - SWAGGER API DOCUMENTATION CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Arvind Party API',
      version: '1.0.0',
      description: 'Arvind Party Backend API Documentation',
      contact: {
        name: 'Arvind Party Team',
        email: 'dev@arvindparty.com'
      },
      license: {
        name: 'Internal Use Only'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:5000',
        description: 'API Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token'
        }
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful' },
            data: { type: 'object' },
            meta: {
              type: 'object',
              properties: {
                page: { type: 'integer', example: 1 },
                limit: { type: 'integer', example: 20 },
                total: { type: 'integer', example: 100 },
                totalPages: { type: 'integer', example: 5 },
                hasNextPage: { type: 'boolean', example: true },
                hasPrevPage: { type: 'boolean', example: false }
              }
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error message' },
            code: { type: 'string', example: 'ERROR_CODE' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'fieldName' },
                  message: { type: 'string', example: 'Field error message' }
                }
              }
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 100 },
            totalPages: { type: 'integer', example: 5 },
            hasNextPage: { type: 'boolean', example: true },
            hasPrevPage: { type: 'boolean', example: false }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User management endpoints' },
      { name: 'Rooms', description: 'Room management endpoints' },
      { name: 'Wallet', description: 'Wallet and transaction endpoints' },
      { name: 'Gifts', description: 'Gift system endpoints' },
      { name: 'Agency', description: 'Agency management endpoints' },
      { name: 'Families', description: 'Family/Guild system endpoints' },
      { name: 'Shop', description: 'Shop and item endpoints' },
      { name: 'Games', description: 'Game endpoints' },
      { name: 'Rankings', description: 'Ranking and leaderboard endpoints' },
      { name: 'VIP', description: 'VIP system endpoints' },
      { name: 'Chat', description: 'Chat and messaging endpoints' },
      { name: 'Events', description: 'Event system endpoints' },
      { name: 'Tournaments', description: 'Tournament and championship endpoints' },
      { name: 'Moments', description: 'Moments/Posts endpoints' },
      { name: 'Notifications', description: 'Notification endpoints' },
      { name: 'Support', description: 'Support and ticket endpoints' },
      { name: 'Analytics', description: 'Analytics and reporting endpoints' },
      { name: 'Security', description: 'Security and admin endpoints' },
      { name: 'Infrastructure', description: 'Infrastructure management endpoints' }
    ]
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js']
};

const specs = swaggerJsdoc(options);

module.exports = specs;