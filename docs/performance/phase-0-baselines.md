# Phase 0 — Interaction latency baselines

Establish baseline numbers for tenant and customer portals **before** Phase 4 layout work.

## Targets (from interaction-latency-plan.md)


| Metric                          | Target                              |
| ------------------------------- | ----------------------------------- |
| Perceived click feedback        | < 100ms (skeleton or optimistic UI) |
| Tenant nav TTFB (p95)           | < 800ms                             |
| Server action → UI update (p95) | < 1s                                |
| Web Vitals INP (p75)            | “Good” (< 200ms)                    |


## Enable logging

### Client (browser console)

In `.env.local`:

```bash
NEXT_PUBLIC_PORTAL_PERF_LOG=1
```

Optional beacon ingest (staging):

```bash
NEXT_PUBLIC_PORTAL_PERF_ENDPOINT=/api/internal/portal-perf
PORTAL_PERF_INGEST=1
```

Open DevTools → Console and filter for `[portal-perf]`.

### Server (layout + proxy timing)

```bash
DEBUG_PERF=1
```

Restart `npm run dev`. Server logs include:

- `[portal-perf] { kind: 'server_timing', label: 'tenant.layout', ... }`
- `[portal-perf] { kind: 'server_timing', label: 'proxy.request', ... }`

## Critical flows to baseline

Record **p95 or typical** `durationMs` from `interaction_end` events.


| Flow                  | How to trigger                                | Event `flow`            |
| --------------------- | --------------------------------------------- | ----------------------- |
| Quotes Kanban drag    | Drag a card to another column                 | `quotes_board_drag`     |
| Customer create       | Tenant → Customers → New → submit             | `customer_create`       |
| Visit complete        | Schedule visit detail → Complete job → submit | `visit_complete`        |
| Nav to schedule       | Click Schedule in sidebar (from another page) | `nav_schedule`          |
| Customer quote accept | Customer portal → quote → Accept              | `customer_quote_accept` |


## Web Vitals

With `NEXT_PUBLIC_PORTAL_PERF_LOG=1`, each navigation reports:

- `INP`, `LCP`, `CLS`, `FCP`, `TTFB`

Note the **INP** and **TTFB** values on tenant `/schedule` and `/quotes` after a cold load.

## Baseline worksheet

Fill in after exercising each flow on **staging** (or local with production-like data):


| Flow                  | Run 1 (ms) | Run 2 (ms) | Run 3 (ms) | Notes |
| --------------------- | ---------- | ---------- | ---------- | ----- |
| quotes_board_drag     | 3345.8     |            |            |       |
| customer_create       |            |            |            |       |
| visit_complete        | 2309.7     |            |            |       |
| nav_schedule          | 1404.29    |            |            |       |
| customer_quote_accept |            |            |            |       |



| Web Vital | Tenant /quotes | Tenant /schedule | Customer /quotes |
| --------- | -------------- | ---------------- | ---------------- |
| INP (p75) |                |                  |                  |
| TTFB      | 63 / "good"    | 67.199 / "good"  |                  |
| LCP       | 2040 / "good"  | 1312 / "good"    |                  |


## Exit criteria

- All five flows exercised; `interaction_end` durations captured
- Web Vitals logged on tenant + customer shell
- Server timing captured with `DEBUG_PERF=1` for at least one nav
- Worksheet filled in (or linked from release notes)

## Implementation reference


| Piece               | Path                                           |
| ------------------- | ---------------------------------------------- |
| Web Vitals reporter | `components/performance/WebVitalsReporter.tsx` |
| Interaction marks   | `lib/performance/portalInteractionPerf.ts`     |
| Server timing       | `lib/performance/debugPerf.ts`                 |
| Ingest route        | `app/api/internal/portal-perf/route.ts`        |


