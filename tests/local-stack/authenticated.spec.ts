import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import accounts from '../../scripts/local-stack/qa-accounts.json';

const shots = 'test-results/local-stack';
const password = accounts.password;
const residentialOrigin = `http://${accounts.residential.slug}.lvh.me:3000`;
const customerOrigin = 'http://my.lvh.me:3000';

async function shot(page: Page, name: string) {
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
}

async function signIn(page: Page, origin: string, email: string) {
  await page.goto(`${origin}/sign-in`);
  await expect(page.getByRole('heading', { name: /sign in to clean scheduler/i })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 30_000 });
}

test('office sign-in cannot see the other tenant', async ({ page }) => {
  await signIn(page, residentialOrigin, accounts.residential.owner.email);
  await shot(page, 'office-signed-in');

  await page.goto(`${residentialOrigin}/customers`);
  await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View Riley Example' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'View Casey Example' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'View Quinn Example' })).toHaveCount(0);
  await shot(page, 'office-customer-list');

  await page.goto(`${residentialOrigin}/customers?q=Quinn`);
  await expect(page.getByText('No customers match your search.').first()).toBeVisible();
  await expect(page.getByText('Quinn Example')).toHaveCount(0);
  await shot(page, 'office-cross-tenant-search');

  await page.goto(`${residentialOrigin}/customers/${accounts.commercial.customers.quinn.id}`);
  await expect(page.getByRole('heading', { name: /can't find that page/i })).toBeVisible();
  await expect(page.getByText('Quinn Example')).toHaveCount(0);
  await shot(page, 'office-cross-tenant-direct-url');
});

test('office create and edit show geocode badge states', async ({ page }) => {
  await signIn(page, residentialOrigin, accounts.residential.owner.email);
  await page.goto(`${residentialOrigin}/customers/${accounts.residential.customers.riley.id}`);
  await expect(page.getByRole('heading', { name: 'Riley Example' })).toBeVisible();
  const cabin = page.locator('details').filter({ hasText: 'Riley cabin' }).first();
  const lake = page.locator('details').filter({ hasText: 'Riley lake' }).first();
  await expect(cabin.getByText("Couldn't locate this address", { exact: true })).toBeVisible();
  await expect(lake.getByText('Lookup will retry', { exact: true })).toBeVisible();
  await shot(page, 'office-seeded-geocode-badges');

  await page.getByRole('button', { name: 'Add location' }).click();
  await expect(page.getByRole('heading', { name: 'Add service location' })).toBeVisible();
  await page.locator('#new_prop_label').fill('QA outage cabin');
  await page.locator('#new_a1').fill('100 Outage Lane');
  await page.locator('#new_city').fill('Austin');
  await page.locator('#new_state').fill('TX');
  await page.locator('#new_zip').fill('78701');
  await page
    .locator('form')
    .filter({ has: page.locator('#new_a1') })
    .getByRole('button', { name: 'Add location' })
    .click();

  const created = page.locator('details').filter({ hasText: 'QA outage cabin' }).first();
  await expect(created.getByText('Lookup will retry', { exact: true })).toBeVisible();
  await shot(page, 'office-lookup-will-retry');

  await created.locator('summary').click();
  await created.locator('input[name="address_line1"]').fill('200 Nomatch Road');
  await created.locator('input[name="city"]').fill('Austin');
  await created.locator('input[name="state"]').fill('TX');
  await created.locator('input[name="postal_code"]').fill('78701');
  await created.getByRole('button', { name: 'Save location' }).click();
  await expect(created.getByText("Couldn't locate this address", { exact: true })).toBeVisible();
  await expect(created.getByText('Lookup will retry', { exact: true })).toHaveCount(0);
  await shot(page, 'office-could-not-locate');
});

test('business plan keeps the day map and shows a plan upgrade for Pro SMS', async ({ page }) => {
  await signIn(page, residentialOrigin, accounts.residential.owner.email);

  await page.goto(`${residentialOrigin}/schedule/map`);
  await expect(page.getByRole('heading', { name: 'Day map' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /upgrade/i })).toHaveCount(0);
  await shot(page, 'office-day-map');

  await page.goto(`${residentialOrigin}/settings/operations`);
  const upgrade = page.getByRole('heading', { name: 'Upgrade to unlock text notifications' });
  await expect(upgrade).toBeVisible();
  const panel = upgrade.locator('..');
  await expect(panel).toContainText(/Pro includes customer text alerts/i);
  await expect(panel).not.toContainText(/add-on/i);
  await expect(panel.getByRole('link', { name: 'View workspace billing' })).toHaveAttribute(
    'href',
    '/billing',
  );
  await shot(page, 'office-sms-plan-upgrade');

  const applicant = page.locator('#applicant-texting');
  await expect(applicant).toContainText('0/100 applicant SMS segments this month');
  await expect(applicant).not.toContainText(/add-on/i);
  await expect(applicant.getByRole('link', { name: 'Buy a text pack' })).toHaveAttribute(
    'href',
    '/billing#text-packs',
  );
});

test('active Business owner sees applicant texting and hidden text packs', async ({ page }) => {
  await signIn(page, residentialOrigin, accounts.residential.owner.email);
  await page.goto(`${residentialOrigin}/billing`);
  const packs = page.locator('#text-packs');
  await expect(packs.getByRole('heading', { name: 'Text packs' })).toBeVisible();
  await expect(packs).toContainText('0/100 applicant SMS segments this month');
  await expect(packs).toContainText('Text packs are not available yet');
  await expect(packs.getByRole('button', { name: /Buy 1,000/ })).toHaveCount(0);
  await expect(packs).not.toContainText('Texting unlocks once your subscription starts');
  await expect(packs).not.toContainText(/add-on/i);
  await shot(page, 'office-text-packs-unavailable');
});

test('customer portal sign-in can request a property', async ({ page }) => {
  await signIn(page, customerOrigin, accounts.residential.portalUser.email);
  await shot(page, 'customer-signed-in');

  await page.goto(`${customerOrigin}/properties/new`);
  await expect(page.getByRole('heading', { name: 'Request a location' })).toBeVisible();
  await page.getByLabel('Location name').fill('QA portal cottage');
  await page.getByLabel('Street').fill('400 Portal Lane');
  await page.getByLabel('City').fill('Asheville');
  await page.getByLabel('State').fill('NC');
  await page.getByLabel('Postal code').fill('28801');
  await page.getByRole('button', { name: 'Request this location' }).click();

  await expect(page).toHaveURL(/\/properties\?requested=1/);
  await expect(
    page.getByText('Request sent. Your cleaner will schedule a consultation.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('QA portal cottage').first()).toBeVisible();
  await shot(page, 'customer-property-request');
});
