module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2021,
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_|next|req|res' }],
    'no-undef': 'error',
  },
  ignorePatterns: ['node_modules/', 'coverage/', 'logs/'],
};
