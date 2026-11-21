# Multi-cleaner dispatch (T4)

Owner-approved assignment of one day's visits across cleaners. Product copy is `docs/product/dispatch.md`. The single-cleaner engine is `docs/agents/routing-engine.md`.

## Decisions

- `planDispatchHaversine` in `lib/routing/dispatchPlan.ts` is the straight-line plan. It pins locked and team visits, then assigns flexible geocoded visits to the nearest cleaner, breaking ties by fewer stops and then cleaner id. Each cleaner's order reuses `optimizeHaversine` (nearest neighbor, then 2-opt). Miles are straight-line.
- `FleetRouteOptimizer` reuses the T3 Valhalla matrix reader and VROOM client (`postJson`, `readMatrix`, `routableIndexes`). One request, profile `auto`, one vehicle per cleaner, custom matrices. A flexible job only lists vehicles that pass the same shift, time-off, and blocked-cleaner checks as the straight-line plan. Time off that a pinned visit covers is trimmed, and the rest of that block stays a vehicle break. After the solve, a flexible stop on a blocked cleaner, outside the shift, on time off, or overlapping another stop on that route is removed and listed as unassigned. A stop with no finite path from the start is unassigned as `No road route`. VROOM `unassigned` does not fail the day unless a pinned visit is dropped or moved. Timeout, suppression, bad JSON, and a pinned-visit miss fall back to the straight-line plan. Logs stay `reason=` plus `operation=dispatch` when suppressed. No token, URL, or coordinates.
- Apply is `apply_cleaner_dispatch` (migration `0133`). It locks the snapshot rows, compares times, status, check-in, route sequence, updated time, and assignees, then writes assignees and `route_sequence` in that transaction. Service role only. The action still checks owner or admin from `tenant_memberships.role`, the `multiCleanerDispatch` flag, and that every visit and new cleaner belongs to the tenant. The hidden form fields are a fingerprint and a plan key. The server rebuilds the plan and rejects a mismatch. It does not read `user_metadata`.
- `0133` is not applied to shared dev or production by this change. Local-stack CI applies it only on the disposable database.
- Apply emails affected cleaners from the server action after the RPC succeeds. The SQL function still does not send mail. Do not call the visit webhook from this action. SMS stays off. See `docs/agents/cleaner-schedule-email.md`.
- Gate is `isFeatureEnabled(plan, 'multiCleanerDispatch')` on `resolveTenantRoutingPlan`: Business and Pro on, Starter, trial, and raw Stripe `paused` off. `past_due` keeps the paid plan. The office sees the upgrade sentence. Field employees see nothing. `loadDispatchPlan` returns before the engine when the flag is off. See `docs/agents/routing-entitlements.md`.
- Re-optimize, extra start locations, and drive-time reports are Pro. See `docs/agents/pro-routing.md`. A cleaner with no saved start still begins at the business coordinates. Starter, Business, and the trial do not read saved homes or named places. Only `multipleStartLocations` feeds those points into the solver.

## Constraints already used

- Fixed arrival, consultation, check-in, and completed visits stay with the current crew and keep time order inside that crew.
- Two or more current assignees stay together. A required crew of two or more is left in place with **Needs more than one cleaner** when that crew is not already assigned. This screen does not invent a team.
- Approved time off and the member's work window for that weekday block new work. A locked visit still stays if that person is off.
- Overlapping appointment times are not given to the same cleaner. Appointment clocks are not moved.
- Blocked cleaners on the customer or property scheduling facts are skipped for flexible visits.
- `tenant_member_scheduling_profiles.max_jobs_per_day` caps flexible assignments. A blank field saves null and is the only no-limit value. `parseDailyJobCap` rejects anything else that is not a whole number from 1 to 20, including 0, instead of clamping. The column check is still null or 1–20. The planner treats null as no cap. Jobs that stay put count first: pinned, team, missing-point, and an uncovered required crew. Each person on a team visit counts that job, even when the stop is ordered on the first assignee only. The overflow reason and that cleaner’s list say **At the daily job cap (includes N team visits)** when team visits fill the cap, and **Near the daily job cap** when one job of room remains. Flexible visits count only after they are placed, including one that was already on that cleaner. A cleaner already over the cap from jobs that stay keeps those jobs and receives nothing new. `dispatchUnassignedNotice` is the office line with a count per reason. `loadDispatchPlan` reads `max_jobs_per_day` for the dispatch crew after the Business gate. Home coordinates are still read only when `multipleStartLocations` is on. `applyDispatchAction` calls `dispatchJobCapBreach` after rebuilding the plan and before `apply_cleaner_dispatch`, using a fresh profile read. A stale plan that would add jobs past the cap is rejected. No new migration.

## Gaps

- Preferred cleaners, skills, equipment, and soft zones are not scored.
- Partial time off is a hard block for a visit that overlaps it. There is no split visit.
- A team visit is ordered on the first assigned cleaner id who is in the dispatch crew. The other people do not get a second route.
- Valhalla's matrix is about 400 km. A pair with no path becomes **No road route** for that stop, or the whole day falls back to straight-line miles when the solve itself fails.
- Apply notifies cleaners by email when their crew or stop order changed. SMS stays off.
- `route_sequence` is still migration `0130`. Apply needs `0133` as well. Neither file is applied to hosted databases here.
