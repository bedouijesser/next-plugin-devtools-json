import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 60000, // Increased to 60 seconds for integration tests
    // Exclude patterns for files we don't want to test
    exclude: [
      '**/node_modules/**',
      '**/dist/**'
    ],
  },
});
