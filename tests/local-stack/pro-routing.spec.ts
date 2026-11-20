import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import accounts from '../../scripts/local-stack/qa-accounts.json';

const shots = 'test-results/local-stack';
const password = accounts.password;
const residentialOrigin = `http://${accounts.residential.slug}.lvh.me:3000`;
const commercialOrigin = `http://${accounts.commercial.slug}.lvh.me:3000`;
const proOrigin = `http://${accounts.pro.slug}.lvh.me:3000`;
const otherTenant = ['Quinn Example', '500 Office Park', 'Parker Owner', 'qa-commercial'];

function workspaceDayKey(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function shot(page: Page, name: string) {
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
}

async function keepTrafficLocal(page: Page) {
  await page.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    const local =
      host === 'localhost' || host === '127.0.0.1' || host === 'lvh.me' || host.endsWith('.lvh.me');
    if (local) return route.continue();
    return route.abort();
  });
}

async function signIn(page: Page, origin: string, email: string) {
  await page.goto(`${origin}/sign-in`);
  await expect(page.getByRole('heading', { name: /sign in to clean scheduler/i })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 30_000 });
}

async function expectUpgrade(page: Page, heading: string) {
  const region = page.getByRole('region', { name: heading, exact: true });
  await expect(region).toBeVisible();
  await expect(region).toContainText('included in the Pro plan');
  await expect(region).not.toContainText(/add-on/i);
}

test('pro office can re-optimize, set a start, and read drive time', async ({ page }) => {
  await keepTrafficLocal(page);
  const day = workspaceDayKey(accounts.timeZone);
  await signIn(page, proOrigin, accounts.pro.owner.email);
  const response = await page.goto(`${proOrigin}/schedule?view=day&date=${day}`);
  expect(response?.status() ?? 500).toBeLessThan(500);
  await expect(page.getByRole('heading', { name: 'Re-optimize', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply re-optimize', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Re-optimize', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Re-optimize changes' })).toContainText(
    'Pro locked stays fixed',
  );
  await page.getByRole('button', { name: 'Apply re-optimize', exact: true }).click();
  await expect(page.getByText('Re-optimize saved.')).toBeVisible();
  for (const text of otherTenant) {
    await expect(page.getByText(text)).toHaveCount(0);
  }
  await shot(page, 'pro-reoptimize');

  await page.goto(`${proOrigin}/schedule/starts`);
  await expect(page.getByRole('heading', { level: 1, name: /Start locations/ })).toBeVisible();
  await expect(page.getByText('Home: 9 Hidden Lane', { exact: true })).toBeVisible();
  await expect(page.getByText('Home: 1 Office Home', { exact: true })).toBeVisible();
  await page.getByLabel('Location name').fill('South shed');
  await page.getByLabel('Street').fill('12 Shed Road');
  await page.getByLabel('City').fill('Asheville');
  await page.getByLabel('State').fill('NC');
  await page.getByLabel('Postal code').fill('28801');
  await page.getByRole('button', { name: 'Save start location', exact: true }).click();
  await expect(page.getByText('Start location saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('list', { name: 'Start locations' })).toContainText('South shed');
  await page.getByLabel('Start for Sam Route').selectOption({ label: 'South shed' });
  await page.getByRole('button', { name: 'Save start for Sam Route', exact: true }).click();
  await expect(page.getByText('Saved the default start.')).toBeVisible();
  for (const text of otherTenant) {
    await expect(page.getByText(text)).toHaveCount(0);
  }
  await shot(page, 'pro-start-locations');

  await page.goto(`${proOrigin}/schedule/drive-time`);
  await expect(page.getByRole('heading', { level: 1, name: /Drive time/ })).toBeVisible();
  const row = page.getByRole('row', { name: /Sam Route/ });
  await expect(row).toContainText('straight-line estimate');
  await expect(row).not.toContainText('Engine drive time');
  await expect(page.getByText('Parker Owner')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'By cleaner and day' })).toContainText(
    'This is not driving miles.',
  );
  await shot(page, 'pro-drive-time');
  const csv = await page.request.get(
    `${proOrigin}/schedule/drive-time/export?from=2020-01-01&to=2035-01-01`,
  );
  expect(csv.ok()).toBe(true);
  const body = await csv.text();
  expect(body).toContain('Sam Route');
  expect(body).toContain('Straight-line estimate');
  expect(body).not.toContain('Parker Owner');
});

test('business and starter offices see a plan upgrade', async ({ page }) => {
  await keepTrafficLocal(page);
  const day = workspaceDayKey(accounts.timeZone);
  await signIn(page, residentialOrigin, accounts.residential.owner.email);
  await page.goto(`${residentialOrigin}/schedule?view=day&date=${day}`);
  await expectUpgrade(page, 'Re-optimize');
  await expect(page.getByRole('button', { name: 'Re-optimize', exact: true })).toHaveCount(0);
  await page.goto(`${residentialOrigin}/schedule/starts`);
  await expectUpgrade(page, 'Start locations');
  await expect(page.getByRole('button', { name: 'Save start location', exact: true })).toHaveCount(
    0,
  );
  await page.goto(`${residentialOrigin}/schedule/drive-time`);
  await expectUpgrade(page, 'Drive time');
  await shot(page, 'business-routing-upgrade');

  await signIn(page, commercialOrigin, accounts.commercial.owner.email);
  await page.goto(`${commercialOrigin}/schedule?view=day&date=${day}`);
  await expectUpgrade(page, 'Re-optimize');
  await page.goto(`${commercialOrigin}/schedule/starts`);
  await expectUpgrade(page, 'Start locations');
  await page.goto(`${commercialOrigin}/schedule/drive-time`);
  await expectUpgrade(page, 'Drive time');
  await expect(page.getByText('Sam Route')).toHaveCount(0);
  await expect(page.getByText('9 Hidden Lane')).toHaveCount(0);
});

test('field employee cannot use pro routing extras', async ({ page }) => {
  await keepTrafficLocal(page);
  const day = workspaceDayKey(accounts.timeZone);
  await signIn(page, residentialOrigin, accounts.residential.cleaner.email);
  await page.goto(`${residentialOrigin}/schedule?view=day&date=${day}`);
  await expect(page.getByRole('heading', { name: 'Re-optimize', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Re-optimize', exact: true })).toHaveCount(0);
  const starts = await page.goto(`${residentialOrigin}/schedule/starts`);
  expect(starts?.status() ?? 500).toBeLessThan(500);
  await expect(page).not.toHaveURL(/\/schedule\/starts/);
  await expect(page.getByRole('heading', { name: 'Start locations', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save start location', exact: true })).toHaveCount(
    0,
  );

  await signIn(page, proOrigin, accounts.pro.cleaner.email);
  const proStarts = await page.goto(`${proOrigin}/schedule/starts`);
  expect(proStarts?.status() ?? 500).toBeLessThan(500);
  await expect(page).not.toHaveURL(/\/schedule\/starts/);
  await expect(page.getByText('1 Office Home')).toHaveCount(0);
  await expect(page.getByText('9 Hidden Lane')).toHaveCount(0);
  const drive = await page.goto(`${proOrigin}/schedule/drive-time`);
  expect(drive?.status() ?? 500).toBeLessThan(500);
  await expect(page).not.toHaveURL(/\/schedule\/drive-time/);
  await expect(page.getByRole('heading', { name: 'Drive time', exact: true })).toHaveCount(0);
  await expect(page.getByText('straight-line estimate')).toHaveCount(0);
  await shot(page, 'field-pro-routing');
});
