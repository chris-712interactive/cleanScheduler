# Plan tiers, not add-ons (T6a)

Session notes for removing add-on purchase language and recording routing on Starter, Business, and Pro.

## Decisions

- Clean Scheduler does not sell add-ons. A blocked feature says which plan includes it: `This feature is included in the <Plan> plan. Upgrade your plan to use it.` A limit says the current plan cap and to upgrade the plan. `smsGateErrorMessage` still rewrites the SMS limit into “SMS segments this month.”
- There is no add-on flag, SKU, or grant in `lib/billing/entitlements.ts`. Nothing new is turned on except the routing flags below, and those flags are not consulted by the day map. `/schedule/map` is not gated.
- Routing flags (prices unchanged at $39 / $129 / $299):

  | Flag                        | Starter | Business | Pro | Trial |
  | --------------------------- | ------- | -------- | --- | ----- |
  | `dayMap`                    | yes     | yes      | yes | yes   |
  | `singleCleanerStopOrdering` | yes     | yes      | yes | yes   |
  | `multiCleanerDispatch`      | no      | yes      | yes | no    |
  | `routeReoptimization`       | no      | no       | yes | no    |
  | `multipleStartLocations`    | no      | no       | yes | no    |
  | `driveTimeReports`          | no      | no       | yes | no    |

- `minimumTierForFeature` is derived from `PLATFORM_TIER_ENTITLEMENTS`, lowest of Starter, Business, Pro. The free trial is not a minimum tier.
- `lib/routing/`, `app/tenant/schedule/map`, and the schedule day view were left alone so the parallel stop-ordering work and the day map do not collide.
- `UpgradeOrAddOnModal` still has that file name. The dialog only links to `/billing` with “Upgrade plan.” Renaming it would touch every caller for no user-facing change.
- `tenant_addons` and `plan_features` were never migrated. Do not add them. Visit “add-on” amounts (`coverage_addon_invoice_id`, quote home add-ons, consultation add-ons) are cleaning extras on a job, not platform features. Leave those words.

## Ambiguous, left unmapped

- Hiring SMS for Business. Applicant texts stay on Pro (`smsCommunication`).
- Background-check vendor ordering. Not on a plan until a vendor agreement exists.
- The old $9/seat and $5/100-customer overage prices. Not products. Limits stay on the plan.
- Inbound / two-way SMS. Still a non-goal.

## Tests

- Vitest: `lib/billing/entitlements.test.ts` covers the routing matrix, the feature sentence, and the limit sentence.
- Local-stack Playwright: the `@example.test` business owner opens `/schedule/map` (heading “Day map”, no upgrade wall) and `/settings/operations` (Pro SMS panel plus the billing link). The seeded plan is Business, so SMS is the simple gated path.
