# Stop order (T3a)

One cleaner's suggested stop order. Product copy is in `docs/product/stop-order.md`.

## Decisions

- `RouteOptimizer` in `lib/routing/types.ts` is the seam. `createRouteOptimizer()` returns `HaversineRouteOptimizer`. A Valhalla/VROOM engine can implement the same interface later. Do not add an env var or a paid routing call for this ticket.
- The pure engine is haversine miles, nearest-neighbor with a stable tie break, then best-improvement 2-opt. A 2-opt move is kept only when it is shorter and locked stops stay in time order.
- A stop is locked when the customer or the property has a specific arrival window, the visit is a consultation, or it is checked in or completed. Morning / afternoon / evening is not a lock.
- Ungeocoded visits use `dayMapMissingReasonLabel` and are excluded from the path. The day-map row loader (`loadDayMapRows` / `describeDayMapVisit`) is the source of the point, so a visit property is not replaced by another property on the customer.
- The start point is `tenants.latitude/longitude` when both are set. Otherwise the first routed stop is the start, which keeps that stop first because its distance from the start is zero.
- `auto_schedule_sequence` is the nth visit created from a quote line (unique per line, max 52). It is not a route order. `route_sequence` is a new nullable integer on `tenant_scheduled_visits` (migration `0130`). Existing member policies cover the column. Do not apply `0130` from an agent or from CI. Schedule and day-map reads retry without the column when Postgres returns `42703` (or PostgREST `PGRST204`) for `route_sequence`, and treat the sequence as null. Apply stays disabled until the column exists.
- Apply recomputes the order on the server. It checks `tenant_memberships.role` for the signed-in user and requires owner or admin. It does not read `user_metadata`. Every update filters `tenant_id`.
- The schedule day view and `/schedule/map` both render `StopOrderPanel`. Field employees are not given the panel. The day map still redirects them.
- Starter, Business, Pro, and the trial include this (`singleCleanerStopOrdering` in `lib/billing/entitlements.ts`). Do not add a tier check on the panel. The flag is already on for every plan.

## Tests

`lib/routing/haversineOptimizer.test.ts` covers determinism, locked order, ungeocoded exclusion, and 2-opt versus nearest-neighbor.

`tests/local-stack/stop-order.spec.ts` signs in with the `@example.test` seed. The residential owner suggests and applies Drew Cleaner's day. The field employee has no apply control. Quinn's commercial visit is absent from the page and from local responses.

`supabase/tests/rls/visit_route_sequence.sql` is an extra RLS smoke file. A member can set `route_sequence` on their visit and cannot read or update the other tenant's visit.

## Seed notes

The local-stack residential office is geocoded at 35.55, -82.55. Drew's day has Route west, Route locked (arrival window on Riley home), Route south, and Route cabin (no point). The straight-line suggestion is Route locked, Route south, Route west. Casey's visit stays on Avery so the day map still has two cleaner colors. Drew's pin count in `day-map.spec.ts` is 4 (legend plus three geocoded stops).
