# Plan tiers, not add-ons (T6a)

Session notes for removing add-on purchase language and recording routing on Starter, Business, and Pro.

## Decisions

- Clean Scheduler does not sell feature add-ons. A blocked feature says which plan includes it: `This feature is included in the <Plan> plan. Upgrade your plan to use it.` A limit says the current plan cap and to upgrade the plan. The only prepaid extra is a text pack (1,000 SMS segments for $15, or 2,500 for $35). UI copy says text pack, never add-on.
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
- Stop order from #282 is owner/admin only and reads `route_sequence` with a fallback when migration `0130` is absent. `singleCleanerStopOrdering` is on for every plan, including the trial, so that screen is not gated. Drive time appears only when the self-hosted engine answers. Otherwise the screen stays straight-line. Suggest dispatch is the Business flag `multiCleanerDispatch`. Starter and the trial see the upgrade sentence. See `docs/agents/dispatch.md`. Pro re-optimize, start locations, and the drive-time report use the three Pro flags. See `docs/agents/pro-routing.md`. Billing screens beyond that upgrade sentence are still open.
- `UpgradeOrAddOnModal` still has that file name. The dialog only links to `/billing` with “Upgrade plan.” Renaming it would touch every caller for no user-facing change.
- `tenant_addons` and `plan_features` were never migrated. Do not add them. Visit “add-on” amounts (`coverage_addon_invoice_id`, quote home add-ons, consultation add-ons) are cleaning extras on a job, not platform features. Leave those words.

## Ambiguous, left unmapped

- Hiring SMS for Business is decided: 100 applicant SMS segments a month, then text packs. Pro applicant texts use the Pro allowance. Texting requires billing status `active`.
- Background-check vendor ordering. Not on a plan until a vendor agreement exists.
- The old $9/seat and $5/100-customer overage prices. Not products. Limits stay on the plan.
- Inbound / two-way SMS. Still a non-goal.

## Tests

- Vitest: `lib/billing/entitlements.test.ts` covers the routing matrix, the feature sentence, and the limit sentence.
- Local-stack Playwright: the `@example.test` business owner opens `/schedule/map` (heading “Day map”, no upgrade heading) and `/settings/operations` (Pro SMS panel plus the billing link). The panel itself must not say “add-on.” The rest of Operations still lists consultation “Add-ons,” which are cleaning extras, not a platform purchase. The seeded plan is Business, so SMS is the simple gated path.
