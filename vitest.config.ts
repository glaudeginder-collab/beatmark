import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['api/**/*.test.ts', 'api/__tests__/**/*.test.ts', 'tests/**/*.test.ts'],
  },
  resolve: {
    // Allow resolving relative paths from api/ to backend/ and shared/
    alias: {},
  },
});
