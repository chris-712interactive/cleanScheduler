# Marketing screenshots

The marketing site uses product screenshots in `public/marketing/`. By default these are
design-reference PNGs copied from `docs/design/portal-mockups/`. To refresh them from a live
demo tenant, use the Playwright capture script.

## Prerequisites

1. **Dev server running**

   ```bash
   npm run dev
   ```

2. **Demo tenant** with representative data (dashboard stats, quotes, schedule, invoices,
   customers, payment audits). Create one via `/start-trial` or use an existing workspace.

3. **Environment variables** in `.env.local`:

   ```env
   MARKETING_SCREENSHOT_TENANT_SLUG=your-demo-slug
   MARKETING_SCREENSHOT_EMAIL=owner@example.com
   MARKETING_SCREENSHOT_PASSWORD=your-password
   MARKETING_SCREENSHOT_BASE_URL=http://lvh.me:3000
   ```

4. **Playwright browsers** (one-time):

   ```bash
   npx playwright install chromium
   ```

## Capture

```bash
npm run marketing:screenshots
```

Outputs to `public/marketing/`:

| File                          | Source route                    |
| ----------------------------- | ------------------------------- |
| `hero-dashboard.png`          | `/`                             |
| `feature-schedule.png`        | `/schedule/reschedule-requests` |
| `feature-quotes.png`          | `/quotes`                       |
| `feature-billing.png`         | `/billing/invoices`             |
| `feature-customers.png`       | `/customers`                    |
| `feature-reports.png`         | `/billing/payment-audits`       |
| `feature-portals.png`         | `/billing`                      |
| `feature-schedule-mobile.png` | `/schedule` (mobile viewport)   |
| `og-home.png`                 | Copy of hero dashboard          |

Images are optimized with `sharp` after capture.

## Without credentials

If screenshot env vars are not set, the script skips gracefully. The site continues to use
the static mockups in `public/marketing/`.

## Customer portal

Customer portal screenshots (`my.<domain>`) are not automated yet. Add a demo customer account
and extend `scripts/marketing-screenshots/capture.spec.ts` when needed.
