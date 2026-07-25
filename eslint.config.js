import globals from 'globals';
import js from '@eslint/js';

export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|next|req|res' }],
      'no-undef': 'error',
    },
  },
  {
    ignores: ['node_modules/', 'coverage/', 'logs/', 'dist/'],
  },
];
