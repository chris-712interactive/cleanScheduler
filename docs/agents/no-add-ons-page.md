# Public no-add-ons comparison

`/no-add-ons` (`app/marketing/no-add-ons/page.tsx`) is the marketing page for plan-included features. It is linked from pricing, the compare hub, the marketing footer, and `app/sitemap.ts`.

## Clean Scheduler cells

`lib/marketing/noAddOnComparison.ts` reads `PLATFORM_TIER_ENTITLEMENTS`. Do not hardcode plan prices or which tier includes a feature.

- Monthly price and annual-effective rates come from `monthlyPriceUsd` and `annualEffectiveMonthlyUsd`.
- There is no per-user fee. Office and field seats come from the plan limits.
- Route optimization is `routeReoptimization` (Pro). Multi-cleaner dispatch is `multiCleanerDispatch` (Business and Pro). Online booking is `publicBookingRequest` (all paid plans).
- Two-way texting has no entitlement flag. The cell says it is not included. Outbound customer texts follow `smsCommunication` (Pro). Prepaid text packs stay the only extra charge. Copy uses `TEXT_PACKS` and `TEXT_PACK_PLAN_MESSAGE`.

## Competitor cells (checked Nov 2026)

Confirmed on the public pages and shown with source links:

- Jobber (https://www.getjobber.com/pricing/): Core $49/mo billed monthly, or $29/mo billed annually. Extra users $29/mo each. Other Jobber plan prices are omitted because the page changes them by team size and promotion. Feature rows other than price say “Varies, see their site.”
- Housecall Pro (https://www.housecallpro.com/pricing/): Basic $79/mo, Essentials $189/mo, Max $329/mo. Billed annually those cards show $59, $149, and $299 per month. Route optimization is listed on Max. Max also says 8 users included and $35/mo per additional user. Basic says 1 user included and Essentials says 5, and those cards do not state an extra-user price. Promotional “50% off for 3 months” prices are omitted. Other Housecall Pro feature rows say “Varies, see their site.”

The page disclaimer says those public prices may change.
