import { expect, test, type Request } from '@playwright/test';
import { assertHttpsDevUrl, isAllowedDevHostname } from '../../lib/hosted-dev/hostedDevUrl';

function isAppMutation(request: Request): boolean {
  if (request.method() === 'GET' || request.method() === 'HEAD') return false;
  return isAllowedDevHostname(new URL(request.url()).hostname);
}

test.beforeEach(async ({ page }) => {
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return;
    const url = frame.url();
    if (url === 'about:blank') return;
    assertHttpsDevUrl(url);
  });
});

test('deployment identity is hosted dev', async ({ request }) => {
  const response = await request.get('/api/health/deployment', { maxRedirects: 0 });
  expect(
    response.status(),
    'GET /api/health/deployment must identify this deployment. A 404 means the running deploy does not include the endpoint yet.',
  ).toBe(200);
  const body = (await response.json()) as {
    appEnv?: string;
    appDomain?: string;
    gitSha?: string;
  };
  expect(body.appEnv).toBe('dev');
  expect(body.appDomain).toBe('dev.cleanscheduler.com');
  const expected = process.env.HOSTED_DEV_EXPECT_SHA?.trim();
  if (expected) expect(body.gitSha).toBe(expected);
});

test('cron, Stripe, and Plaid entry points do not run without credentials', async ({ request }) => {
  const cronPaths = [
    '/api/cron/materialize-recurring-visits',
    '/api/cron/outreach-send',
    '/api/cron/visit-reminders',
    '/api/cron/invoice-reminders',
    '/api/cron/plaid-sync',
  ];
  for (const path of cronPaths) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect([401, 501], path).toContain(response.status());
  }

  const stripe = await request.post('/api/webhooks/stripe', {
    data: '{}',
    headers: { 'content-type': 'application/json' },
    maxRedirects: 0,
  });
  expect([400, 501]).toContain(stripe.status());

  const plaid = await request.get('/api/tenant/plaid/link-token', { maxRedirects: 0 });
  expect([400, 401, 501]).toContain(plaid.status());
  const plaidBody = (await plaid.json().catch(() => null)) as { link_token?: string } | null;
  expect(plaidBody?.link_token).toBeUndefined();
});

test('marketing home and pricing render', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Run your cleaning business from one console' }),
  ).toBeVisible();
  await page.goto('/pricing');
  await expect(
    page.getByRole('heading', { name: 'Plans that grow with your cleaning business' }),
  ).toBeVisible();
});

test('sign-in page renders and is not submitted', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (isAppMutation(request)) posts.push(new URL(request.url()).pathname);
  });
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: /sign in to clean scheduler/i })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(posts.filter((path) => !path.startsWith('/_next'))).toEqual([]);
  await page.screenshot({ path: 'hosted-dev-results/sign-in.png', fullPage: false });
});

test('password reset and trial pages render without a submission', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (isAppMutation(request)) posts.push(new URL(request.url()).pathname);
  });
  await page.goto('/forgot-password');
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await page.goto('/start-trial');
  await expect(page.getByRole('heading', { name: 'Start your 7-day free trial' })).toBeVisible();
  expect(posts.filter((path) => !path.startsWith('/_next'))).toEqual([]);
});

test('admin and customer hosts require sign-in on the same host', async ({ page }) => {
  await page.goto('https://admin.dev.cleanscheduler.com/');
  await expect(page).toHaveURL(/https:\/\/admin\.dev\.cleanscheduler\.com\/sign-in\?next=%2F/);
  await expect(page.getByRole('heading', { name: /sign in to clean scheduler/i })).toBeVisible();

  await page.goto('https://my.dev.cleanscheduler.com/');
  await expect(page).toHaveURL(/https:\/\/my\.dev\.cleanscheduler\.com\/sign-in\?next=%2F/);
});

test('an unknown tenant host stays on that host at sign-in', async ({ page }) => {
  await page.goto('https://qa-hosted-dev-absent.dev.cleanscheduler.com/');
  await expect(page).toHaveURL(
    /https:\/\/qa-hosted-dev-absent\.dev\.cleanscheduler\.com\/sign-in\?next=%2F/,
  );
});

test('www on the dev apex redirects to the apex', async ({ page }) => {
  await page.goto('https://www.dev.cleanscheduler.com/');
  await expect(page).toHaveURL('https://dev.cleanscheduler.com/');
});

const bookingUrl = process.env.HOSTED_DEV_BOOKING_URL?.trim();
if (bookingUrl) {
  test('configured public booking page is read only', async ({ page }) => {
    const target = assertHttpsDevUrl(bookingUrl);
    const posts: string[] = [];
    page.on('request', (request) => {
      if (isAppMutation(request)) posts.push(new URL(request.url()).pathname);
    });
    await page.goto(target.toString());
    await expect(page.getByRole('heading').first()).toBeVisible();
    expect(posts.filter((path) => !path.startsWith('/_next'))).toEqual([]);
  });
}
