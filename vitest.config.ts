import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['apps/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@opentakeoff/backend': resolve(__dirname, './apps/backend/src'),
      '@opentakeoff/frontend': resolve(__dirname, './apps/frontend/src'),
      '@opentakeoff/ui': resolve(__dirname, './packages/ui/src'),
      '@opentakeoff/config': resolve(__dirname, './packages/config/src'),
    },
  },
});
