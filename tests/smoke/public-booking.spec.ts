import { test, expect } from '@playwright/test';

const bookingUrl = process.env.PLAYWRIGHT_BOOKING_URL;

test.describe('public instant booking', () => {
  test.skip(!bookingUrl, 'Set PLAYWRIGHT_BOOKING_URL to a tenant /book page.');

  test('shows the booking page heading and a way to continue', async ({ page }) => {
    await page.goto(bookingUrl!);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const unavailable = page.getByText(/online booking is unavailable/i);
    const continueButton = page.getByRole('button', {
      name: /see times and price|request a quote/i,
    });
    await expect(unavailable.or(continueButton)).toBeVisible();
  });
});
