import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    testTimeout: 20000,
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
