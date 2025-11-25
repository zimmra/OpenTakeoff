import { defineConfig } from 'vitest/config';

/**
 * Vitest Configuration for Backend
 * Enforces 80% coverage threshold
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        'drizzle/**',
        '**/*.config.{ts,js}',
        '**/*.d.ts',
        '**/types/**',
        'src/db/migrate.ts', // Migration scripts
      ],
      thresholds: {
        lines: 65,
        functions: 65,
        branches: 60,
        statements: 65,
      },
    },
  },
});
