import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import accounts from '../../scripts/local-stack/qa-accounts.json';

const shots = 'test-results/local-stack';
const password = accounts.password;
const residentialOrigin = `http://${accounts.residential.slug}.lvh.me:3000`;
const hiddenText = ['Quinn Example', '500 Office Park', 'Parker Owner', 'qa-commercial'];

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
  const leaks: string[] = [];
  page.on('response', async (response) => {
    const host = new URL(response.url()).hostname;
    const local =
      host === 'localhost' || host === '127.0.0.1' || host === 'lvh.me' || host.endsWith('.lvh.me');
    if (!local) return;
    let body = '';
    try {
      body = await response.text();
    } catch {
      return;
    }
    for (const text of hiddenText) {
      if (body.includes(text)) leaks.push(text);
    }
  });
  await page.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    const local =
      host === 'localhost' || host === '127.0.0.1' || host === 'lvh.me' || host.endsWith('.lvh.me');
    if (local) return route.continue();
    return route.abort();
  });
  return leaks;
}

async function signIn(page: Page, email: string) {
  await page.goto(`${residentialOrigin}/sign-in`);
  await expect(page.getByRole('heading', { name: /sign in to clean scheduler/i })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 30_000 });
}

async function expectNoOtherTenant(page: Page) {
  for (const text of hiddenText) {
    await expect(page.getByText(text)).toHaveCount(0);
  }
  const html = await page.content();
  for (const text of hiddenText) {
    expect(html).not.toContain(text);
  }
}

test('office can suggest and apply dispatch across two cleaners', async ({ page }) => {
  const leaks = await keepTrafficLocal(page);
  const day = workspaceDayKey(accounts.timeZone);
  await signIn(page, accounts.residential.owner.email);
  const response = await page.goto(`${residentialOrigin}/schedule?view=day&date=${day}`);
  expect(response?.status() ?? 500).toBeLessThan(500);
  await expect(page.getByRole('heading', { name: 'Suggest dispatch' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply dispatch' })).toHaveCount(0);
  await expect(page.getByText('This is not driving miles.')).toBeVisible();

  await page.getByRole('button', { name: 'Suggest dispatch' }).click();
  const drew = page.getByRole('list', { name: 'Dispatch for Drew Cleaner' });
  const avery = page.getByRole('list', { name: 'Dispatch for Avery Owner' });
  const blake = page.getByRole('list', { name: 'Dispatch for Blake Admin' });
  await expect(drew).toContainText('Route locked');
  await expect(drew).not.toContainText('Route west');
  await expect(avery).toContainText('Route west');
  await expect(blake).toContainText('Route south');
  await expect(page.getByText(/Total: .* mi straight-line estimate/)).toBeVisible();

  const unassigned = page.getByRole('list', { name: 'Unassigned visits' });
  await expect(unassigned.getByText('Route cabin')).toBeVisible();
  await expect(unassigned.getByText("Couldn't locate this address", { exact: true })).toBeVisible();
  await expect(unassigned.getByText('Casey Example')).toHaveCount(0);

  await page.getByRole('button', { name: 'Apply dispatch' }).click();
  await expect(page.getByText('Dispatch saved.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Suggest dispatch' }).click();
  await expect(page.getByRole('list', { name: 'Dispatch for Avery Owner' })).toContainText(
    'Route west',
  );
  await expect(page.getByRole('list', { name: 'Dispatch for Drew Cleaner' })).toContainText(
    'Route locked',
  );
  await expectNoOtherTenant(page);
  expect(leaks).toEqual([]);
  await shot(page, 'office-suggest-dispatch');

  const map = await page.goto(`${residentialOrigin}/schedule/map?date=${day}`);
  expect(map?.status() ?? 500).toBeLessThan(500);
  await expect(page.getByRole('heading', { name: 'Suggest dispatch' })).toBeVisible();
  await page.getByRole('button', { name: 'Suggest dispatch' }).click();
  await expect(page.getByRole('list', { name: 'Dispatch for Blake Admin' })).toContainText(
    'Route south',
  );
  await expectNoOtherTenant(page);
  expect(leaks).toEqual([]);
  await shot(page, 'office-day-map-dispatch');
});

test('field employee cannot suggest or apply dispatch', async ({ page }) => {
  const leaks = await keepTrafficLocal(page);
  const day = workspaceDayKey(accounts.timeZone);
  await signIn(page, accounts.residential.cleaner.email);
  const response = await page.goto(`${residentialOrigin}/schedule?view=day&date=${day}`);
  expect(response?.status() ?? 500).toBeLessThan(500);
  await expect(page.getByRole('button', { name: 'Suggest dispatch' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Apply dispatch' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Suggest dispatch' })).toHaveCount(0);
  await expectNoOtherTenant(page);
  expect(leaks).toEqual([]);
  await shot(page, 'field-employee-dispatch');
});
