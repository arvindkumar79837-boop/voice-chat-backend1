// =========================================================================
// JEST TESTING CONFIGURATION
// Quality Assurance & Automated Testing Setup
// =========================================================================

module.exports = {
  // Test environment for Node.js backend
  testEnvironment: 'node',
  // Test file patterns
  testMatch: ['**/tests/**/*.test.js', '**/__tests__/**/*.test.js'],

  // Code coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/middlewares/**', // Exclude middleware from coverage
    '!src/config/**', // Exclude config files from coverage
  ],

  // Coverage thresholds (70% minimum)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Coverage report formats
  coverageReporters: ['text', 'lcov', 'html'],

  // Verbose output for detailed test results
  verbose: true,

  // Test timeout (30 seconds for integration tests)
  testTimeout: 30000,
};
