import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * Tests core upload-takeoff-export workflow
 *
 * Environment Variables:
 * - E2E_MODE: Set to 'docker' to run tests against Docker stack
 * - E2E_BASE_URL: Override frontend URL (default: http://localhost:5173)
 * - E2E_API_BASE_URL: Override backend API URL (default: http://localhost:3001)
 */

const isDockerMode = process.env.E2E_MODE === 'docker';
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const apiBaseURL = process.env.E2E_API_BASE_URL || 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Pass API base URL to tests via extraHTTPHeaders or testInfo
    extraHTTPHeaders: {
      'X-E2E-API-Base': apiBaseURL,
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  // Only start local dev server if not running in Docker mode
  webServer: isDockerMode
    ? undefined
    : {
        command: 'pnpm dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});
