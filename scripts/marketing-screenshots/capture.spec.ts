/**
 * Captures authenticated tenant portal screenshots for the marketing site.
 *
 * Prerequisites:
 *   1. Dev server running: npm run dev
 *   2. Demo tenant with sample data
 *   3. Env vars set (see .env.example MARKETING_SCREENSHOT_*)
 *
 * Run: npm run marketing:screenshots
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { test, type Page } from '@playwright/test';
import sharp from 'sharp';

const tenantSlug = process.env.MARKETING_SCREENSHOT_TENANT_SLUG?.trim();
const email = process.env.MARKETING_SCREENSHOT_EMAIL?.trim();
const password = process.env.MARKETING_SCREENSHOT_PASSWORD?.trim();
const baseUrl = (process.env.MARKETING_SCREENSHOT_BASE_URL ?? 'http://lvh.me:3000').replace(
  /\/$/,
  '',
);

const outputDir = path.join(process.cwd(), 'public', 'marketing');
const hasCredentials = Boolean(tenantSlug && email && password);

type CaptureTarget = {
  name: string;
  browserPath: string;
  output: string;
  waitSelector?: string;
};

const DESKTOP_CAPTURES: CaptureTarget[] = [
  { name: 'Dashboard', browserPath: '/', output: 'hero-dashboard.png', waitSelector: 'h1' },
  {
    name: 'Reschedule requests',
    browserPath: '/schedule/reschedule-requests',
    output: 'feature-schedule.png',
  },
  { name: 'Quotes', browserPath: '/quotes', output: 'feature-quotes.png' },
  { name: 'Invoices', browserPath: '/billing/invoices', output: 'feature-billing.png' },
  { name: 'Customers', browserPath: '/customers', output: 'feature-customers.png' },
  {
    name: 'Payment audits',
    browserPath: '/billing/payment-audits',
    output: 'feature-reports.png',
  },
  { name: 'Billing hub', browserPath: '/billing', output: 'feature-portals.png' },
];

const MOBILE_CAPTURES: CaptureTarget[] = [
  { name: 'Schedule (mobile)', browserPath: '/schedule', output: 'feature-schedule-mobile.png' },
];

function tenantOrigin(): string {
  const parsed = new URL(baseUrl);
  return `${parsed.protocol}//${tenantSlug}.${parsed.host}`;
}

async function optimizePng(filePath: string): Promise<void> {
  const buffer = await fs.readFile(filePath);
  const optimized = await sharp(buffer).png({ compressionLevel: 9 }).toBuffer();
  await fs.writeFile(filePath, optimized);
}

async function signIn(page: Page): Promise<void> {
  await page.goto(`${tenantOrigin()}/sign-in?next=/`, { waitUntil: 'networkidle' });
  await page.locator('#pw-email').fill(email!);
  await page.locator('#pw-password').fill(password!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', {
    timeout: 30_000,
  });
}

async function capturePage(page: Page, target: CaptureTarget): Promise<void> {
  await page.goto(`${tenantOrigin()}${target.browserPath}`, { waitUntil: 'networkidle' });

  if (target.waitSelector) {
    await page.locator(target.waitSelector).first().waitFor({ state: 'visible', timeout: 15_000 });
  }

  const outputPath = path.join(outputDir, target.output);
  await page.screenshot({ path: outputPath, fullPage: false });
  await optimizePng(outputPath);
  console.log(`  ✓ ${target.name} → public/marketing/${target.output}`);
}

test.describe('marketing screenshots', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await fs.mkdir(outputDir, { recursive: true });
  });

  test('capture desktop and mobile portal screenshots', async ({ page, browser }) => {
    test.skip(!hasCredentials, 'Missing MARKETING_SCREENSHOT_* env vars');

    console.log(`Signing in to ${tenantOrigin()}…`);
    await signIn(page);

    console.log('Capturing desktop screenshots…');
    for (const target of DESKTOP_CAPTURES) {
      await capturePage(page, target);
    }

    console.log('Capturing mobile screenshots…');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await signIn(mobilePage);

    for (const target of MOBILE_CAPTURES) {
      await capturePage(mobilePage, target);
    }

    await mobileContext.close();

    await fs.copyFile(
      path.join(outputDir, 'hero-dashboard.png'),
      path.join(outputDir, 'og-home.png'),
    );
    console.log('  ✓ Copied hero-dashboard.png → og-home.png');
  });
});
