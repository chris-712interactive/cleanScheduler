import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import accounts from '../../scripts/local-stack/qa-accounts.json';

const shots = 'test-results/local-stack';
const password = accounts.password;
const residentialOrigin = `http://${accounts.residential.slug}.lvh.me:3000`;
const series = accounts.residential.recurring;

async function shot(page: Page, name: string) {
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
}

async function signIn(page: Page) {
  await page.goto(`${residentialOrigin}/sign-in`);
  await expect(page.getByRole('heading', { name: /sign in to clean scheduler/i })).toBeVisible();
  await page.getByLabel('Email').fill(accounts.residential.owner.email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 30_000 });
}

async function openVisit(page: Page, visitId: string, title: string) {
  await page.goto(`${residentialOrigin}/schedule/${visitId}`);
  await expect(page.getByRole('heading', { name: 'Riley Example' })).toBeVisible();
  await expect(page.getByRole('paragraph').filter({ hasText: title })).toBeVisible();
}

async function setSameDayWindow(page: Page, start: string, end: string) {
  const startInput = page.locator('#visit_edit_starts_at');
  const current = await startInput.inputValue();
  const date = current.slice(0, 10);
  await startInput.fill(`${date}T${start}`);
  await page.locator('#visit_edit_ends_at').fill(`${date}T${end}`);
}

test('owner chooses this visit only or this and future visits', async ({ page }) => {
  await signIn(page);
  await openVisit(page, series.thisVisitId, 'Weekly QA this');
  await expect(page.locator('#visit_edit_starts_at')).toHaveValue(/T18:00$/);
  await setSameDayWindow(page, '18:30', '19:30');
  await page.getByRole('button', { name: 'Save time' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit repeating visit' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'This visit only' }).click();
  await expect(page.getByText('Visit time saved.', { exact: true })).toBeVisible();
  await shot(page, 'recurring-scope-this-visit');

  await openVisit(page, series.nextVisitId, 'Weekly QA next');
  await expect(page.locator('#visit_edit_starts_at')).toHaveValue(/T18:00$/);
  await expect(page.locator('#visit_edit_ends_at')).toHaveValue(/T19:00$/);

  await setSameDayWindow(page, '18:30', '19:30');
  await page.getByRole('button', { name: 'Save time' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'This and future visits' }).click();
  await expect(page.getByText('Visit time saved.', { exact: true })).toBeVisible();
  await shot(page, 'recurring-scope-this-and-future');

  await openVisit(page, series.laterVisitId, 'Weekly QA later');
  await expect(page.locator('#visit_edit_starts_at')).toHaveValue(/T18:30$/);
  await expect(page.locator('#visit_edit_ends_at')).toHaveValue(/T19:30$/);

  await openVisit(page, series.movedVisitId, 'Weekly QA moved');
  await expect(page.locator('#visit_edit_starts_at')).toHaveValue(/T13:00$/);
  await expect(page.locator('#visit_edit_ends_at')).toHaveValue(/T15:00$/);

  await openVisit(page, series.pastVisitId, 'Weekly QA past');
  const overview = page.getByLabel('Appointment overview');
  await expect(overview).toContainText('6:00 PM');
  await expect(overview).toContainText('7:00 PM');
  await expect(page.locator('#visit_edit_starts_at')).toHaveCount(0);
});
