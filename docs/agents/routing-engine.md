# Routing engine (T3)

Single-cleaner stop order can use a self-hosted Valhalla matrix and a VROOM solve. Product copy is in `docs/product/stop-order.md`. The VPS bundle is `infra/routing/README.md`.

## Decisions

- `createRouteOptimizer()` in `lib/routing/createRouteOptimizer.ts` is what the schedule calls. Both env vars blank: `HaversineRouteOptimizer`. Either var set: `EngineRouteOptimizer`, including a rejected URL, so a bad config is logged and still falls back.
- The engine is server-only. `ROUTING_ENGINE_URL` and `ROUTING_ENGINE_TOKEN` are not `NEXT_PUBLIC_`. The client view gets miles, minutes, and `estimateKind`. It does not get the URL or the token.
- HTTP is allowed only for loopback. Anything else must be `https`. A URL with a user, password, query, or hash is ignored. Redirects are errors, so the bearer token is not forwarded.
- One deadline covers both calls. Default 3000 ms. `ROUTING_ENGINE_TIMEOUT_MS` is honored only from 200 to 8000.
- `OUTBOUND_SUPPRESSED=1` is checked with `isOutboundSuppressed()` before any `fetch`. The log is `provider=routing operation=optimize` plus `reason=suppressed`. No socket.
- Timeout, HTTP error, bad JSON, an empty reachable set, unassigned jobs, or a locked-stop violation returns `optimizeHaversine`. Logs are `reason=timeout|error|bad-response|unassigned|lock-order` and never include the token, the URL, or coordinates.
- Locked stops get non-overlapping VROOM time windows wider than a full tour, so flexible stops can sit between them and waiting does not change the travel cost. The result is still checked against lock order.
- A stop with no finite drive from the start, or that cannot be paired with the stops that remain, is unrouted as `No road route`. Other stops still use the engine. If none remain, the whole day falls back to straight-line miles.
- The matrix is `costing: auto`, `units: miles`. VROOM profile is `auto`. Durations are seconds. Distances are meters. The vehicle has a start and no end, so it does not return to the office.
- No migration for the single-cleaner engine. `route_sequence` is still `0130`. Multi-cleaner dispatch is `docs/agents/dispatch.md` and uses `0133` for the atomic apply. Re-optimize, extra starts, and drive-time reports are still later tickets.
- CI does not call a real engine. Tests pass a mock `fetch`. Local-stack leaves the env vars unset, so the straight-line copy stays what `tests/local-stack/stop-order.spec.ts` looks for.

## Verify against a live engine later

Build `infra/routing` for one state. Set the two app env vars. Open one cleaner's day, choose Suggest stop order, and confirm the lines say `min drive` and miles, not `straight-line estimate`. Then stop the VPS or set a 200 ms timeout and reload. The same day should return to the straight-line label without an error page.
