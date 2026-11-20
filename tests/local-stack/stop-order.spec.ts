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

function milesFrom(text: string): number {
  const match = /([\d.]+) mi straight-line estimate/.exec(text);
  if (!match) throw new Error(`No straight-line estimate in: ${text}`);
  return Number(match[1]);
}

test('office can suggest and apply one cleaner stop order', async ({ page }) => {
  const leaks = await keepTrafficLocal(page);
  const day = workspaceDayKey(accounts.timeZone);
  const cleanerId = accounts.residential.cleaner.userId;
  await signIn(page, accounts.residential.owner.email);
  const response = await page.goto(
    `${residentialOrigin}/schedule?view=day&date=${day}&employee=${cleanerId}`,
  );
  expect(response?.status() ?? 500).toBeLessThan(500);
  await expect(page.getByRole('heading', { name: 'Suggest stop order' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply stop order' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Suggest stop order' }).click();
  const suggested = page.getByRole('list', { name: 'Suggested stop order' });
  await expect(suggested).toBeVisible();
  const suggestedText = await suggested.innerText();
  expect(suggestedText).toContain('Route locked');
  expect(suggestedText).toContain('Fixed time');
  expect(suggestedText).toContain('Route west');
  expect(suggestedText).toContain('Route south');
  expect(suggestedText).not.toContain('Route cabin');
  expect(suggestedText).not.toContain('Casey Example');
  expect(suggestedText.indexOf('Route west')).toBeGreaterThan(
    suggestedText.indexOf('Route locked'),
  );

  const before = milesFrom(await page.getByText(/Before: .* straight-line estimate/).innerText());
  const after = milesFrom(await page.getByText(/After: .* straight-line estimate/).innerText());
  expect(after).toBeLessThanOrEqual(before);
  await expect(
    page.getByText('Straight-line estimate for Drew Cleaner. This is not driving miles.'),
  ).toBeVisible();

  const notRouted = page.getByRole('list', { name: 'Not routed' });
  await expect(notRouted.getByText('Route cabin')).toBeVisible();
  await expect(notRouted.getByText("Couldn't locate this address", { exact: true })).toBeVisible();
  await expect(notRouted.getByText('Casey Example')).toHaveCount(0);

  await page.getByRole('button', { name: 'Apply stop order' }).click();
  await expect(page.getByText('Stop order saved.')).toBeVisible();
  await page.reload();
  const saved = page.getByRole('list', { name: 'Saved stop order' });
  await expect(saved).toBeVisible();
  expect((await saved.innerText()).trim()).toBe(suggestedText.trim());
  await expect(page.getByText('Stop 1').first()).toBeVisible();
  await expectNoOtherTenant(page);
  expect(leaks).toEqual([]);
  await shot(page, 'office-stop-order');

  const map = await page.goto(`${residentialOrigin}/schedule/map?date=${day}&cleaner=${cleanerId}`);
  expect(map?.status() ?? 500).toBeLessThan(500);
  await expect(page.getByRole('heading', { name: 'Day map' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Saved stop order' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Saved stop order' })).toContainText('Route locked');
  await expectNoOtherTenant(page);
  expect(leaks).toEqual([]);
  await shot(page, 'office-day-map-stop-order');
});

test('field employee cannot apply a stop order', async ({ page }) => {
  const leaks = await keepTrafficLocal(page);
  const day = workspaceDayKey(accounts.timeZone);
  await signIn(page, accounts.residential.cleaner.email);
  const response = await page.goto(`${residentialOrigin}/schedule?view=day&date=${day}`);
  expect(response?.status() ?? 500).toBeLessThan(500);
  await expect(page.getByRole('button', { name: 'Suggest stop order' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Apply stop order' })).toHaveCount(0);
  await expect(page.getByText('Only the office can apply a stop order.')).toHaveCount(0);
  await expectNoOtherTenant(page);
  expect(leaks).toEqual([]);
  await shot(page, 'field-employee-stop-order');
});
