import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for marketing screenshot capture only.
 * Run: npm run marketing:screenshots (requires dev server + demo tenant credentials)
 */
export default defineConfig({
  testDir: './scripts/marketing-screenshots',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    ignoreHTTPSErrors: true,
  },
});
