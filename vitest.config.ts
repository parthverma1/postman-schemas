import { defineConfig } from 'vitest/config';

// Standalone config so vitest doesn't load vite.config.ts (tanstackStart + nitro plugins).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
