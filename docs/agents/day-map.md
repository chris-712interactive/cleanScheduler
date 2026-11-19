# Day map (T2)

Office map of one day's visits. Product copy is in `docs/product/day-map.md`.

## Decisions

- Route is `/schedule/map`. The schedule header links here for anyone who is not a field employee. `fieldEmployeeCanAccessBrowserPath` blocks `/schedule/map`, and the page redirects field employees to `/schedule`. Anyone without `schedule.view` is sent home. Viewers who can see the schedule can open the map.
- No schema change. Points and `geocode_reason` already live on `tenant_customer_properties` (`0129` / `0109`).
- `loadDayMap` uses `createTenantPortalDbClient()` after `requireTenantPortalAccess`. That client bypasses RLS, so the query filters `tenant_id` to `membership.tenantId` from the membership lookup. `shapeDayMap` drops any row whose `tenant_id` does not match, and it drops a property point whose `tenant_id` does not match. Do not read `user_metadata` for the tenant.
- A visit with `property_id` uses that property only. A visit with no property falls back to the customer's primary property, matching `resolveVisitSiteLine`.
- Pin color is the alphabetically first assignee. The popup and the side list name every assignee. Unassigned is its own gray group, last in the legend.
- Two visits at the same coordinate are nudged by about 0.00012 degrees so both can be clicked. The stored point on the pin record stays the real coordinate.
- Cancelled visits are excluded. Scheduled and completed visits are included.
- MapLibre is imported only from `app/tenant/schedule/map/DayMapCanvas.tsx`. `DayMap.tsx` loads that file with `next/dynamic` and `ssr: false`. The schedule page does not import it. Tile requests do not attach credentials. The package is `maplibre-gl` 6.19.0. CI runs `npm audit --omit=dev --audit-level=high`, and 5.x through 6.4.0 fail that audit (GHSA-jrc7-96c5-q579, XSS in `DOM.sanitize`). Do not downgrade. The day map builds popups with `textContent`, not `setHTML`.
- `NEXT_PUBLIC_MAP_STYLE_URL` is optional. Blank, non-https, and Mapbox or Google hosts fall back to OpenFreeMap Liberty (`https://tiles.openfreemap.org/styles/liberty`). It is not in the Zod env schema, so a bad value does not take down the rest of the app. Do not put a key in the URL.
- `normalizeDateKey` (shared with the schedule and fill pages) keeps a date only when `Date.UTC` round-trips to the same `YYYY-MM-DD`. Impossible keys such as `2026-13-01` and `2026-02-31` fall back to today's UTC date, the same as a non-date string, so the heading and the visit filter stay on one key. `shiftDateKey` is only called with that normalized key.
- A MapLibre `error` before the style `load` event shows the same fallback sentence as a constructor throw. Errors after `load` do not replace a map that already started. The side lists stay server-rendered either way.
- OpenFreeMap's public terms allow this use with no key and no stated view cap, including commercial use, and they do not offer an SLA. Production should point the env var at a self-hosted Protomaps style. This ticket does not host PMTiles and does not change billing, entitlements, cookie domain, or workflows.

## Tests

`lib/schedule/dayMap.test.ts` covers grouping, the missing-point reasons, tenant drops, the query's `tenant_id` filter, the style URL fallback, and the MapLibre import living only in the canvas.

`tests/local-stack/day-map.spec.ts` runs in the `local-stack` CI job. It signs in as the residential owner and field cleaner from `scripts/local-stack/qa-accounts.json`. Tile hosts are aborted. Assertions use the server-rendered lists. `supabase/tests/rls/day_map_visit_read.sql` runs with the other RLS smoke files: a member can read their own visit point and cannot read the other tenant's visit or address. `visit_route_sequence.sql` checks the stop-order column the same way. The day map page itself still uses the service-role portal client after `requireTenantPortalAccess`, then filters `tenant_id`.

## Not verified here

No signed-in browser pass. CI does not run Playwright or a production-browser session, so the live tile render and the pin click were not exercised against a workspace.
