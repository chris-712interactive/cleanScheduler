import { defineConfig, devices } from '@playwright/test';
import { assertHttpsDevUrl, HOSTED_DEV_ORIGIN } from '../../lib/hosted-dev/hostedDevUrl';

const baseURL = process.env.HOSTED_DEV_BASE_URL?.trim() || HOSTED_DEV_ORIGIN;
assertHttpsDevUrl(baseURL);

const isolated = process.env.HOSTED_DEV_ISOLATED === '1';

export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  timeout: isolated ? 90_000 : 45_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  outputDir: '../../hosted-dev-results/output',
  reporter: [['list'], ['json', { outputFile: '../../hosted-dev-results/playwright.json' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    ignoreHTTPSErrors: false,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: isolated
    ? [
        {
          name: 'isolated',
          testMatch: /isolated\.spec\.ts/,
          use: { screenshot: 'off', trace: 'off' },
        },
      ]
    : [{ name: 'smoke', testMatch: /smoke\.spec\.ts/ }],
});
