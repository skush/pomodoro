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
        // sensory-feedback: browser APIs used by src/ui/ (wake-up worker, chime).
        Worker: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
  {
    files: ['test/**/*.js', 'test-e2e/**/*.js', 'scripts/**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        // page.evaluate() callbacks run in the browser.
        fetch: 'readonly',
        getComputedStyle: 'readonly',
        Event: 'readonly',
        Notification: 'readonly',
        Worker: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
      },
    },
  },
];
