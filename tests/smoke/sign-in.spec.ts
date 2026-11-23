import { test, expect } from '@playwright/test';

test('marketing sign-in page loads', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: /sign in to clean scheduler/i })).toBeVisible();
});

test('no add-ons comparison page loads', async ({ page }) => {
  await page.goto('/no-add-ons');
  await expect(
    page.getByRole('heading', { name: 'All features are included in the plan' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Jobber pricing' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Housecall Pro pricing' })).toBeVisible();
});
