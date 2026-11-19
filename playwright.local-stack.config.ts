import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/local-stack',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  outputDir: 'test-results/local-stack-playwright',
  reporter: [['list'], ['json', { outputFile: '.local-stack/playwright.json' }]],
  use: {
    ...devices['Desktop Chrome'],
    screenshot: 'on',
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'npm run start -- --hostname 0.0.0.0 --port 3000',
    url: 'http://127.0.0.1:3000/sign-in',
    reuseExistingServer: process.env.LOCAL_STACK_REUSE_SERVER === '1',
    timeout: 120_000,
  },
});
