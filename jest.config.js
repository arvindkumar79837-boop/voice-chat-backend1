// =========================================================================
// JEST TESTING CONFIGURATION
// Quality Assurance & Automated Testing Setup
// =========================================================================

module.exports = {
  // Test environment for Node.js backend
  testEnvironment: 'node',
  // Test file patterns
  testMatch: ['**/tests/**/*.test.js', '**/__tests__/**/*.test.js'],

  // Code coverage configuration - only cover routes and controllers
  collectCoverageFrom: [
    'src/routes/**/*.js',
    'src/controllers/**/*.js',
    'src/models/**/*.js',
    '!src/**/*.test.js',
  ],


  // Test path ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/load/', // Exclude load/stress tests from regular test runs
    '/tests/integration/', // Exclude integration tests from regular test runs
  ],

  // Coverage report formats
  coverageReporters: ['text', 'lcov', 'html'],

  // Verbose output for detailed test results
  verbose: true,

  // Test timeout (30 seconds for integration tests)
  testTimeout: 30000,
};
