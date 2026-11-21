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

function mainRegion(page: Page, name: string) {
  // A route swap can leave a second copy of the page in the document.
  // Scope to #main and take one region so the label stays a single match.
  return page.locator('#main').getByRole('region', { name, exact: true }).first();
}

async function expectUpgrade(page: Page, heading: string) {
  const region = mainRegion(page, heading);
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
  const reoptimize = mainRegion(page, 'Re-optimize');
  await expect(reoptimize.getByRole('heading', { name: 'Re-optimize', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply re-optimize', exact: true })).toHaveCount(0);
  await reoptimize.getByRole('button', { name: 'Re-optimize', exact: true }).click();
  await expect(reoptimize.getByRole('list', { name: 'Re-optimize changes' })).toContainText(
    'Pro locked stays fixed',
  );
  await reoptimize.getByRole('button', { name: 'Apply re-optimize', exact: true }).click();
  await expect(reoptimize.getByText('Re-optimize saved.', { exact: true })).toBeVisible();
  for (const text of otherTenant) {
    await expect(page.getByText(text)).toHaveCount(0);
  }
  await shot(page, 'pro-reoptimize');

  await page.goto(`${proOrigin}/schedule/starts`);
  const starts = page.locator('#main');
  await expect(
    starts.getByRole('heading', { level: 1, name: /Start locations/ }).first(),
  ).toBeVisible();
  await expect(
    starts.getByText('Home: 9 Hidden Lane, Asheville, NC', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    starts.getByText('Home: 1 Office Home, Asheville, NC', { exact: true }).first(),
  ).toBeVisible();
  const placeForm = starts.locator('form').filter({ hasText: 'Location name' }).first();
  await placeForm.getByLabel('Location name').fill('South shed');
  await placeForm.getByLabel('Street').fill('12 Shed Road');
  await placeForm.getByLabel('City').fill('Asheville');
  await placeForm.getByLabel('State').fill('NC');
  await placeForm.getByLabel('Postal code').fill('28801');
  await placeForm.getByRole('button', { name: 'Save start location', exact: true }).click();
  await expect(placeForm.getByText('Start location saved.', { exact: true })).toBeVisible();
  await page.reload();
  const savedStarts = page.locator('#main');
  await expect(
    savedStarts.getByRole('list', { name: 'Start locations', exact: true }).first(),
  ).toContainText('South shed');
  const samForm = savedStarts.locator('form').filter({ hasText: 'Sam Route' }).first();
  await samForm.getByLabel('Start for Sam Route').selectOption({ label: 'South shed' });
  await samForm.getByRole('button', { name: 'Save start for Sam Route', exact: true }).click();
  await expect(
    savedStarts.getByText('Saved the default start.', { exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  const savedSam = page.locator('#main').locator('form').filter({ hasText: 'Sam Route' }).first();
  await expect(savedSam.getByLabel('Start for Sam Route').locator('option:checked')).toHaveText(
    'South shed',
  );
  await expect(savedSam.getByLabel('End for Sam Route').locator('option:checked')).toHaveText(
    'No return',
  );
  await expect(
    savedSam.getByText('Saved default start for Sam Route: South shed', { exact: true }),
  ).toBeVisible();
  await expect(
    savedSam.getByText('Saved default end for Sam Route: No return', { exact: true }),
  ).toBeVisible();
  const main = page.locator('#main');
  await main.getByRole('button', { name: 'Edit South shed', exact: true }).click();
  await main.getByLabel('Street for South shed', { exact: true }).fill('44 New Shed Road');
  await main.getByRole('button', { name: 'Save South shed', exact: true }).click();
  await expect(main.getByText('Start location updated.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    main.getByText('44 New Shed Road, Asheville, NC, 28801', { exact: true }),
  ).toBeVisible();
  await expect(
    main.getByLabel('Start for Sam Route', { exact: true }).locator('option:checked'),
  ).toHaveText('South shed');
  const northForm = main.locator('form').filter({ hasText: 'Location name' }).first();
  await northForm.getByLabel('Location name').fill('North shed');
  await northForm.getByLabel('Street').fill('18 North Road');
  await northForm.getByLabel('City').fill('Asheville');
  await northForm.getByLabel('State').fill('NC');
  await northForm.getByLabel('Postal code').fill('28801');
  await northForm.getByRole('button', { name: 'Save start location', exact: true }).click();
  await expect(northForm.getByText('Start location saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    main.getByText('18 North Road, Asheville, NC, 28801', { exact: true }),
  ).toBeVisible();
  await main.getByRole('button', { name: 'Edit South shed', exact: true }).click();
  await main.getByLabel('Street for South shed', { exact: true }).fill('99 nomatch Road');
  await main.getByRole('button', { name: 'Save South shed', exact: true }).click();
  await expect(
    main.getByText("Couldn't find that address. The place was not changed.", { exact: true }),
  ).toBeVisible();
  await expect(
    main.getByText('44 New Shed Road, Asheville, NC, 28801', { exact: true }),
  ).toBeVisible();
  await main.getByRole('button', { name: 'Edit North shed', exact: true }).click();
  await expect(main.getByLabel('Street for North shed', { exact: true })).toBeVisible();
  await expect(
    main.getByText("Couldn't find that address. The place was not changed."),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    main.getByText('44 New Shed Road, Asheville, NC, 28801', { exact: true }),
  ).toBeVisible();
  await expect(main.getByText(/nomatch/i)).toHaveCount(0);
  await expect(
    main.getByLabel('Start for Sam Route', { exact: true }).locator('option:checked'),
  ).toHaveText('South shed');
  for (const text of otherTenant) {
    await expect(page.getByText(text)).toHaveCount(0);
  }
  await shot(page, 'pro-start-locations');

  await page.goto(`${proOrigin}/schedule/drive-time`);
  const drive = page.locator('#main');
  await expect(drive.getByRole('heading', { level: 1, name: /Drive time/ }).first()).toBeVisible();
  const driveRows = mainRegion(page, 'By cleaner and day');
  const row = driveRows.getByRole('row', { name: /Sam Route/ });
  await expect(row).toContainText('straight-line estimate');
  await expect(row).not.toContainText('Engine drive time');
  await expect(page.getByText('Parker Owner')).toHaveCount(0);
  await expect(driveRows).toContainText('This is not driving miles.');
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
  await expect(page.getByRole('button', { name: 'Suggest dispatch', exact: true })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Suggest dispatch', exact: true }),
  ).not.toContainText('Upgrade your plan');
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
  const starterDispatch = page.getByRole('region', { name: 'Suggest dispatch', exact: true });
  await expect(starterDispatch).toBeVisible();
  await expect(starterDispatch).toContainText('included in the Business plan');
  await expect(starterDispatch).not.toContainText(/add-on/i);
  await expect(page.getByRole('button', { name: 'Suggest dispatch', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Apply dispatch', exact: true })).toHaveCount(0);
  await page.goto(`${commercialOrigin}/schedule/map?date=${day}`);
  await expect(page.getByRole('heading', { name: 'Day map' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Suggest dispatch', exact: true })).toContainText(
    'included in the Business plan',
  );
  await expect(page.getByRole('region', { name: 'Start locations', exact: true })).toHaveCount(0);
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
