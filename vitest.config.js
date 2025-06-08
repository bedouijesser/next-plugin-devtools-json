import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    // Exclude patterns for files we don't want to test
    exclude: [
      '**/node_modules/**',
      '**/dist/**'
    ],
  },
});
