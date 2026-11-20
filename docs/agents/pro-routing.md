# Pro routing extras (T5)

Product copy is `docs/product/pro-routing.md`. Dispatch and the single-cleaner engine stay `docs/agents/dispatch.md` and `docs/agents/routing-engine.md`.

## Decisions

- Gates are the flags already on `lib/billing/entitlements.ts`: `routeReoptimization`, `multipleStartLocations`, and `driveTimeReports`. Pro is on. Starter, Business, and the trial are off. The office sees `featureUpgradeMessage`. Field employees see neither the control nor another cleaner's home. There is no add-on SKU.
- T6 still owns billing-page treatment beyond this sentence (checkout, plan comparison, and any other surface that should mention the three tools). These screens only call `isFeatureEnabled` and `featureUpgradeMessage`.
- Re-optimize reuses `loadDispatchPlan`, `holdFixedStops`, `validateDispatchApply`, and `apply_cleaner_dispatch`. The form posts `mode=reoptimize` to `applyDispatchAction`. The plan key is the held plan. The snapshot fingerprint is still the dispatch fingerprint, so the SQL stale check is unchanged. Apply does not run by itself.
- A day counts as changed when `tenant_applied_route_days.day_fingerprint` differs from `optimizeDayFingerprint`. That hash is visits (time, status, check-in, assignees, `route_sequence`) plus approved time off that overlaps the day. `updated_at` is omitted so the apply itself does not immediately look stale. No cron.
- Finished, checked-in, and time-locked visits keep their cleaner and stop number via `holdFixedStops`. Open visits keep the optimizer's cleaner and take the remaining numbers.
- Apply still queues `queueCleanerScheduleNotice` with `scheduleVisitsFromDispatch`. No SMS. The SQL function still does not send mail.
- Start and end are `tenant_route_locations` plus `tenant_cleaner_route_bases` (`service_date` null is the default). Homes stay on `tenant_member_scheduling_profiles` and are not copied. `resolveCleanerBase` feeds `DispatchCleanerInput.start` / `end` and the single-cleaner `RouteOptimizeRequest`. The haversine plan and the Valhalla/VROOM request both use those points. An unset start is still the office, then the first stop.
- The drive-time report reads `tenant_applied_route_days` written by dispatch apply, stop-order apply, and re-optimize apply. It does not call the engine. `estimate_kind = straight-line` forces `drive_seconds` null. Totals do not add those miles into the engine miles.
- Migration **`0134_pro_routing_extras.sql`** is not applied to shared dev or production by this change. Local-stack CI applies it only on the disposable database. RLS: owner/admin manage places and bases; a field employee can select only their own base and drive row; anon and public have no grants; authenticated cannot insert drive rows. `can_manage_route_office` is security definer so the policy does not need a membership-table grant.

## Gaps

- Skills, preferred cleaners, and soft zones are still not scored.
- When a fixed stop is pulled back onto its cleaner, the saved miles can still be the optimizer's miles for the list before that lock. The label stays straight-line or engine, matching the solve.
- A team visit that has not started is still pinned by dispatch. Re-optimize freezes stop numbers only for finished, checked-in, and time-locked visits.
- The Florida extract still cannot route outside Florida. A miss falls back to straight-line and is labeled as an estimate.
- Full billing UX for these flags is T6.
