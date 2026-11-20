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

function shiftDayKey(dateKey: string, deltaDays: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const next = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return next.toISOString().slice(0, 10);
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

test('office day map shows this tenant only', async ({ page }) => {
  const leaks = await keepTrafficLocal(page);
  const day = workspaceDayKey(accounts.timeZone);
  await signIn(page, accounts.residential.owner.email);
  const response = await page.goto(`${residentialOrigin}/schedule/map?date=${day}`);
  expect(response?.status() ?? 500).toBeLessThan(500);
  await expect(page.getByRole('heading', { name: 'Day map' })).toBeVisible();

  const onTheMap = page.getByRole('complementary', { name: 'Day map details' });
  await expect(onTheMap.getByRole('heading', { name: 'Visits on the map' })).toBeVisible();
  await expect(onTheMap.getByRole('link', { name: 'Riley Example' }).first()).toBeVisible();
  await expect(onTheMap.getByRole('link', { name: 'Casey Example' })).toBeVisible();
  await expect(onTheMap.getByText('Drew Cleaner', { exact: true })).toHaveCount(4);
  await expect(onTheMap.getByText('Avery Owner', { exact: true })).toHaveCount(2);

  const cleaners = onTheMap
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Cleaners' }) });
  const drewColor = await cleaners
    .locator('li')
    .filter({ hasText: 'Drew Cleaner' })
    .locator('span')
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  const averyColor = await cleaners
    .locator('li')
    .filter({ hasText: 'Avery Owner' })
    .locator('span')
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(drewColor).not.toBe(averyColor);
  expect(drewColor).not.toBe('rgba(0, 0, 0, 0)');

  await expect(onTheMap.getByText("Couldn't locate this address", { exact: true })).toBeVisible();
  await expect(onTheMap.getByText('Lookup will retry', { exact: true })).toBeVisible();
  await expect(onTheMap.getByText('9 Nomatch Road')).toBeVisible();
  await expect(onTheMap.getByText('15 Retry Street')).toBeVisible();
  await expectNoOtherTenant(page);
  expect(leaks).toEqual([]);
  await shot(page, 'office-day-map');
});

test('office day map day picker and impossible date', async ({ page }) => {
  const leaks = await keepTrafficLocal(page);
  const day = workspaceDayKey(accounts.timeZone);
  const nextDay = shiftDayKey(day, 1);
  await signIn(page, accounts.residential.owner.email);
  await page.goto(`${residentialOrigin}/schedule/map?date=${day}`);
  await expect(page.getByRole('heading', { name: 'Day map' })).toBeVisible();
  const dayInput = page.getByRole('textbox', { name: 'Day' });
  await expect(dayInput).toHaveValue(day);

  await page.getByRole('link', { name: 'Next day' }).click();
  await expect(page).toHaveURL(new RegExp(`date=${nextDay}`));
  await expect(dayInput).toHaveValue(nextDay);
  await expect(page.getByRole('heading', { name: 'Day map' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Riley Example' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Casey Example' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Previous day' }).click();
  await expect(page).toHaveURL(new RegExp(`date=${day}`));
  await expect(page.getByRole('link', { name: 'Riley Example' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Casey Example' })).toBeVisible();

  const impossible = await page.goto(`${residentialOrigin}/schedule/map?date=2026-13-01`);
  expect(impossible?.status() ?? 500).toBeLessThan(500);
  await expect(page.getByRole('heading', { name: 'Day map' })).toBeVisible();
  await expect(page.getByText('RangeError')).toHaveCount(0);
  await expect(page.getByText('Invalid time value')).toHaveCount(0);
  const fallback = await page.getByRole('textbox', { name: 'Day' }).inputValue();
  expect(fallback).not.toBe('2026-13-01');
  expect(fallback).toMatch(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
  await expectNoOtherTenant(page);
  expect(leaks).toEqual([]);
  await shot(page, 'office-day-map-impossible-date');
});

test('field employee cannot open the day map', async ({ page }) => {
  const leaks = await keepTrafficLocal(page);
  const day = workspaceDayKey(accounts.timeZone);
  await signIn(page, accounts.residential.cleaner.email);
  const response = await page.goto(`${residentialOrigin}/schedule/map?date=${day}`);
  expect(response?.status() ?? 500).toBeLessThan(500);
  await expect(page).not.toHaveURL(/\/schedule\/map/);
  await expect(page.getByRole('heading', { name: 'Day map' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Day map' })).toHaveCount(0);
  await expectNoOtherTenant(page);
  expect(leaks).toEqual([]);
  await shot(page, 'field-employee-day-map-blocked');
});
