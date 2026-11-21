# Routing entitlements by plan (T6)

Routing stays inside Starter, Business, and Pro. Prices stay $39 / $129 / $299. There is no add-on SKU. Text packs remain the only prepaid extra.

## Trial, inactive, and paused

`resolveTenantEntitlementPlan` sends every `status = trialing` row to `TRIAL_ENTITLEMENTS`, including a legacy `platform_plan`. A missing billing row is treated as trialing. Trial routing matches Starter: day map and single-cleaner stop ordering on; multi-cleaner dispatch and the three Pro tools off.

`past_due` keeps the stored paid tier, same as other paid features that are not texting. Stripe `paused` is still stored as mapped `active` (`mapStripeSubscriptionStatus`), so the portal stays open and other feature gates keep the paid plan. Routing does not. `resolveTenantRoutingPlan` reads `tenant_billing_accounts.stripe_subscription_status`. When that raw value is `paused`, routing uses `TRIAL_ENTITLEMENTS`: day map and single-cleaner stop ordering stay on; multi-cleaner dispatch, re-optimize, multiple start locations, and drive-time reports stay off. A null raw status, including a database that does not have migration `0132` yet, keeps the mapped plan. No new status value and no new migration.

A canceled billing row or `tenants.is_active = false` does not get a separate routing profile. `requireTenantPortalAccess` locks the workspace (`suspended`) before schedule actions run. A canceled row still resolves to its stored `platform_plan` if something calls the resolver directly.

## Audit (before this change)

| Capability                   | Flag                        | Server                                                                          | UI                                            | Matched the placement?                                             |
| ---------------------------- | --------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| Day map                      | `dayMap`                    | Page loaded pins with no flag check                                             | Schedule link, no upgrade sentence            | Flag matched (on for every plan and the trial). Not enforced.      |
| Single-cleaner stop ordering | `singleCleanerStopOrdering` | Apply action and `loadCleanerStopOrder` called the engine with no flag check    | Panel shown with no upgrade sentence          | Flag matched (on everywhere, including the trial). Not enforced.   |
| Multi-cleaner dispatch       | `multiCleanerDispatch`      | `applyDispatchAction` checked the flag before `loadDispatchPlan`                | Upgrade sentence on the schedule and day map  | Yes. Starter and the trial were already blocked on apply.          |
| Re-optimize                  | `routeReoptimization`       | `applyDispatchAction` with `mode=reoptimize` checked the flag before the engine | Upgrade sentence on the schedule and day map  | Yes.                                                               |
| Multiple start locations     | `multipleStartLocations`    | Start-location actions checked the flag before writes                           | `/schedule/starts` shows the upgrade sentence | Writes matched. The solver still read saved bases for lower tiers. |
| Drive-time reports           | `driveTimeReports`          | Page and CSV export checked the flag. The report does not call the engine       | Upgrade sentence                              | Yes.                                                               |

## What changed

- `dayMap` is checked on `/schedule/map` before pins load. The schedule link is omitted when the flag is off. Every current plan, including the trial, includes it, so the upgrade sentence is not shown.
- `applyStopOrderAction` and `loadCleanerStopOrder` check `singleCleanerStopOrdering` before the engine. The panel uses the same upgrade sentence when the flag is off.
- `loadDispatchPlan` returns before the fleet engine unless `multiCleanerDispatch` or `routeReoptimization` is on. Starter and the trial never reach it.
- Saved home, named places, and return points are read only when `multipleStartLocations` is on. Otherwise the solver starts at the office (then the first stop) and does not add a return.
- The pricing lead, plan-card bullets, and comparison matrix list the six tools from these flags. The matrix rows read `PLATFORM_TIER_ENTITLEMENTS` through `ROUTING_COMPARISON_ROWS`.

No migration. No Stripe or price change.

## Paused routing

`resolveTenantEntitlementPlan` still ignores raw Stripe status. Returning `trial` from that function would turn on trial-only features for a paused Starter workspace (marketing site, job costing, promotions, and others). Routing screens and actions call `resolveTenantRoutingPlan` instead. Schedule still uses the paid plan for `multiLocationControls`.

Portal suspension stays on mapped `status` and `tenants.is_active`. A paused row is mapped `active`, so it does not show the paused-workspace lock. Texting already blocks raw `paused` on its own.

Local stack: `qa-trial` is `trialing` with a null platform plan. `qa-past-due` is Pro with `past_due`. Both are synthetic `@example.test` offices. The browser checks live in `tests/local-stack/pro-routing.spec.ts`.
