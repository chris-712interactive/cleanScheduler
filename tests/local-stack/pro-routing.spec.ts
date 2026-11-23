import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import accounts from '../../scripts/local-stack/qa-accounts.json';

const shots = 'test-results/local-stack';
const password = accounts.password;
const residentialOrigin = `http://${accounts.residential.slug}.lvh.me:3000`;
const commercialOrigin = `http://${accounts.commercial.slug}.lvh.me:3000`;
const proOrigin = `http://${accounts.pro.slug}.lvh.me:3000`;
const trialOrigin = `http://${accounts.trial.slug}.lvh.me:3000`;
const pastDueOrigin = `http://${accounts.pastDue.slug}.lvh.me:3000`;
const pausedOrigin = `http://${accounts.paused.slug}.lvh.me:3000`;
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

async function expectUpgrade(page: Page, heading: string, planName = 'Pro') {
  const region = page.getByRole('region', { name: heading, exact: true });
  await expect(region).toBeVisible();
  await expect(region).toContainText(`included in the ${planName} plan`);
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
  await expect(page.getByText('Home: 9 Hidden Lane, Asheville, NC', { exact: true })).toBeVisible();
  await expect(page.getByText('Home: 1 Office Home, Asheville, NC', { exact: true })).toBeVisible();
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
  await page.reload();
  await expect(page.getByLabel('Start for Sam Route').locator('option:checked')).toHaveText(
    'South shed',
  );
  await expect(page.getByLabel('End for Sam Route').locator('option:checked')).toHaveText(
    'No return',
  );
  await expect(
    page.getByText('Saved default start for Sam Route: South shed', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Saved default end for Sam Route: No return', { exact: true }),
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
  await page.getByLabel('Location name').fill('North shed');
  await page.getByLabel('Street').fill('18 North Road');
  await page.getByLabel('City').fill('Asheville');
  await page.getByLabel('State').fill('NC');
  await page.getByLabel('Postal code').fill('28801');
  await page.getByRole('button', { name: 'Save start location', exact: true }).click();
  await expect(page.getByText('Start location saved.')).toBeVisible();
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

test('trial office keeps the day map and stop order and sees upgrade sentences', async ({
  page,
}) => {
  await keepTrafficLocal(page);
  const day = workspaceDayKey(accounts.timeZone);
  const cleanerId = accounts.trial.cleaner.userId;
  await signIn(page, trialOrigin, accounts.trial.owner.email);
  await page.goto(`${trialOrigin}/schedule?view=day&date=${day}&employee=${cleanerId}`);
  await expectUpgrade(page, 'Suggest dispatch', 'Business');
  await expect(page.getByRole('button', { name: 'Suggest dispatch', exact: true })).toHaveCount(0);
  await expectUpgrade(page, 'Re-optimize');
  await expect(page.getByRole('button', { name: 'Re-optimize', exact: true })).toHaveCount(0);
  const stopOrder = page.getByRole('region', { name: 'Suggest stop order', exact: true });
  await expect(stopOrder).toBeVisible();
  await expect(stopOrder).not.toContainText('Upgrade your plan');
  await page.getByRole('button', { name: 'Suggest stop order', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Suggested stop order' })).toContainText(
    'Trial east',
  );
  await page.goto(`${trialOrigin}/schedule/map?date=${day}`);
  await expect(page.getByRole('heading', { name: 'Day map' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Suggest dispatch', exact: true })).toContainText(
    'included in the Business plan',
  );
  await expect(page.getByRole('region', { name: 'Re-optimize', exact: true })).toContainText(
    'included in the Pro plan',
  );
  await expect(
    page.getByRole('region', { name: 'Suggest stop order', exact: true }),
  ).not.toContainText('Upgrade your plan');
  await page.goto(`${trialOrigin}/schedule/drive-time`);
  await expectUpgrade(page, 'Drive time');
  await page.goto(`${trialOrigin}/schedule/starts`);
  await expectUpgrade(page, 'Start locations');
  await shot(page, 'trial-routing');
});

test('past_due pro office keeps paid routing tools', async ({ page }) => {
  await keepTrafficLocal(page);
  const day = workspaceDayKey(accounts.timeZone);
  await signIn(page, pastDueOrigin, accounts.pastDue.owner.email);
  const response = await page.goto(`${pastDueOrigin}/schedule?view=day&date=${day}`);
  expect(response?.status() ?? 500).toBeLessThan(500);
  await expect(page.getByRole('button', { name: 'Suggest dispatch', exact: true })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Suggest dispatch', exact: true }),
  ).not.toContainText('Upgrade your plan');
  await expect(page.getByRole('heading', { name: 'Re-optimize', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Re-optimize', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Re-optimize', exact: true })).not.toContainText(
    'Upgrade your plan',
  );
  await page.getByRole('button', { name: 'Re-optimize', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Re-optimize changes' })).toBeVisible();

  await page.goto(`${pastDueOrigin}/schedule/drive-time`);
  await expect(page.getByRole('heading', { level: 1, name: /Drive time/ })).toBeVisible();
  await expect(page.getByText('included in the Pro plan')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Download CSV' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Jordan Past/ })).toContainText(
    'straight-line estimate',
  );

  await page.goto(`${pastDueOrigin}/schedule/starts`);
  await expect(page.getByRole('heading', { level: 1, name: /Start locations/ })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save start location', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Upgrade your plan')).toHaveCount(0);
  await shot(page, 'past-due-routing');
});

test('paused pro office keeps trial routing and the billing portal', async ({ page }) => {
  await keepTrafficLocal(page);
  const day = workspaceDayKey(accounts.timeZone);
  const cleanerId = accounts.paused.cleaner.userId;
  await signIn(page, pausedOrigin, accounts.paused.owner.email);
  await page.goto(`${pausedOrigin}/schedule?view=day&date=${day}&employee=${cleanerId}`);
  await expectUpgrade(page, 'Suggest dispatch', 'Business');
  await expect(page.getByRole('button', { name: 'Suggest dispatch', exact: true })).toHaveCount(0);
  await expectUpgrade(page, 'Re-optimize');
  await expect(page.getByRole('button', { name: 'Re-optimize', exact: true })).toHaveCount(0);
  const stopOrder = page.getByRole('region', { name: 'Suggest stop order', exact: true });
  await expect(stopOrder).toBeVisible();
  await expect(stopOrder).not.toContainText('Upgrade your plan');
  await page.getByRole('button', { name: 'Suggest stop order', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Suggested stop order' })).toContainText(
    'Pause east',
  );
  await page.goto(`${pausedOrigin}/schedule/map?date=${day}`);
  await expect(page.getByRole('heading', { name: 'Day map' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Suggest dispatch', exact: true })).toContainText(
    'included in the Business plan',
  );
  await expect(page.getByRole('region', { name: 'Re-optimize', exact: true })).toContainText(
    'included in the Pro plan',
  );
  await expect(
    page.getByRole('region', { name: 'Suggest stop order', exact: true }),
  ).not.toContainText('Upgrade your plan');
  await page.goto(`${pausedOrigin}/schedule/drive-time`);
  await expectUpgrade(page, 'Drive time');
  await page.goto(`${pausedOrigin}/schedule/starts`);
  await expectUpgrade(page, 'Start locations');

  const billing = await page.goto(`${pausedOrigin}/billing`);
  expect(billing?.status() ?? 500).toBeLessThan(500);
  await expect(page).toHaveURL(/\/billing\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Billing' })).toBeVisible();
  const plan = page.getByRole('region', { name: 'Your workspace plan' });
  await expect(plan.getByText('Pro', { exact: true })).toBeVisible();
  await expect(plan.getByText('Active', { exact: true })).toBeVisible();
  await expect(
    plan.getByRole('button', { name: 'Manage plan in Stripe', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('This workspace is paused. Pick a plan')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Subscribe to continue' })).toHaveCount(0);
  await shot(page, 'paused-routing');
});
