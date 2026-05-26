import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 30_000,
  fullyParallel: true,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
    ignoreHTTPSErrors: true,
  },
  webServer: process.env.CI
    ? {
        command: 'npm run start',
        url: 'http://127.0.0.1:3000/sign-in',
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
});
