module.exports = {
  root: true,
  extends: '@react-native',
  // Generated, gitignored demo data (base64 frames); not hand-written source, so not linted.
  ignorePatterns: ['src/assets/demo/source.ts'],
  rules: {
    // Project lint rules. Suppressing any of these needs a one-line reason and a tracked issue.
    'no-console': ['warn', {allow: ['warn', 'error']}],
    'no-empty': ['error', {allowEmptyCatch: false}],
    eqeqeq: ['error', 'always'],
    'no-var': 'error',
    'prefer-const': 'error',
    'no-param-reassign': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
    ],
  },
};
