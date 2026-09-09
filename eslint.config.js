import js from '@eslint/js';

export default [
  { ignores: ['index.html', 'node_modules/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        document: 'readonly',
        window: 'readonly',
        setInterval: 'readonly',
      },
    },
  },
  {
    files: ['test/**/*.js', 'scripts/**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
      },
    },
  },
];
