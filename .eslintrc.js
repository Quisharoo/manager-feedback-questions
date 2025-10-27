module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 'latest'
  },
  rules: {
    'indent': ['error', 2, { 'SwitchCase': 1 }],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single', { 'avoidEscape': true }],
    'semi': ['error', 'always'],
    'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
    'no-console': ['warn', { 'allow': ['warn', 'error', 'info'] }],
    'prefer-const': 'warn',
    'no-var': 'error',
    'object-shorthand': 'warn',
    'prefer-arrow-callback': 'warn'
  },
  overrides: [
    {
      files: ['public/**/*.js'],
      env: {
        browser: true,
        node: false
      },
      globals: {
        module: 'writable',
        require: 'readonly'
      }
    },
    {
      files: ['__tests__/**/*.js'],
      env: {
        jest: true
      }
    }
  ]
};
