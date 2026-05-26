import { test, expect } from '@playwright/test';

test('marketing sign-in page loads', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: /sign in to cleanscheduler/i })).toBeVisible();
});
