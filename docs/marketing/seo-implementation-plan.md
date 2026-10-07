# Clean Scheduler SEO — implementation plan

**Date:** 2026-07-31  
**Lane goal:** 10 paying clients by end of 2026  
**Job:** Implementation Plan for Clean Scheduler SEO Recommendations (`KDc6NTWOGorRoaWpL1XlW`)  
**Status:** Plan ready for execution  
**Sources of truth:** `docs/marketing/seo.md`, `docs/product/platform-seo-tasks.md`, `lib/admin/seoTaskCatalog.ts`

---

## Executive summary

Clean Scheduler’s public SEO stack is **already largely shipped**: keyword-aligned landing pages for every June 2026 GSC query cluster, JSON-LD, sitemap/robots, www + `/marketing/*` redirects, GA4, and a founder admin checklist at `admin.<apex>/seo`.

What remains is **execution**, not greenfield page building:

1. **Website polish (code)** — strengthen crawl paths to near-win URLs that exist but are under-linked from the site chrome.
2. **Founder / GSC ops (manual)** — Rich Results validation, indexing requests, live redirect/canonical checks, and recurring monitoring via the admin SEO checklist.
3. **Data-driven content (later)** — expand or deepen pages only after fresh GSC exports show new winners; do not invent speculative pages or `aggregateRating`.

This plan sequences that work so a coding agent can ship Phase 1 in a focused PR, and the founder can complete Phase 2 in Search Console without waiting on engineering.

---

## Baseline (recommendations already captured)

### GSC query → primary URL (June 2026, 28-day window)

From `docs/marketing/seo.md`. Baseline: ~178 impressions, 2 clicks; most queries on pages 7–10. Re-measure after 6–8 weeks.

| Query cluster                           | Primary URL                                                                      | Code status |
| --------------------------------------- | -------------------------------------------------------------------------------- | ----------- |
| Stripe integration                      | `/features/stripe-integration`                                                   | Shipped     |
| Cleaning scheduling software (variants) | `/features/scheduling-and-dispatch`                                              | Shipped     |
| House / residential scheduling          | `/for/residential-cleaning-companies`                                            | Shipped     |
| Commercial / janitorial scheduling      | `/for/commercial-cleaning-companies`                                             | Shipped     |
| Janitorial scheduling + timekeeping     | `/features/crew-scheduling-and-timekeeping`                                      | Shipped     |
| Online payments                         | `/features/invoicing-and-payments`                                               | Shipped     |
| Spreadsheet replacement                 | `/compare/spreadsheets-and-texts`                                                | Shipped     |
| Employee / crew scheduling              | `/features/crew-scheduling-and-timekeeping`, `/help/.../schedule-cleaning-crews` | Shipped     |
| Dispatch software                       | `/help/.../dispatch-vs-scheduling-for-cleaners`                                  | Shipped     |
| Mobile / app                            | `/features/mobile-scheduling-for-cleaners`                                       | Shipped     |
| How to get commercial accounts          | `/help/.../how-to-get-commercial-cleaning-accounts`                              | Shipped     |

**Ignore (do not build chase pages):** WinPure pricing, “scheduled database cleanup”, competitor-only pricing queries with no product fit.

### Architecture already in place

| Layer             | Location                                                               |
| ----------------- | ---------------------------------------------------------------------- |
| Content inventory | `lib/marketing/seoContent/`                                            |
| Page renderer     | `components/marketing/SeoMarketingPage.tsx`, `HelpGuideArticle.tsx`    |
| Metadata helper   | `lib/marketing/marketingPageMetadata.ts`                               |
| JSON-LD           | `lib/marketing/seoJsonLd.ts` (+ tests)                                 |
| Sitemap / robots  | `app/sitemap.ts`, `app/robots.ts`, `getAllPublicSeoPaths()`            |
| Redirects         | `proxy.ts`, `vercel.json` (www → apex; `/marketing/*` HTML collapse)   |
| Analytics         | `components/marketing/GoogleAnalytics.tsx` (`G-70BLY5W13P`, prod only) |
| Founder checklist | `lib/admin/seoTaskCatalog.ts` → `admin.<apex>/seo` (migration `0081`)  |

---

## Gap analysis (recommendations vs live site)

| Gap                                                                | Type        | Action owner                         |
| ------------------------------------------------------------------ | ----------- | ------------------------------------ |
| Footer omits mobile, crew-schedule help, dispatch help, Launch27   | Website     | Coding agent                         |
| Admin checklist near-win / post-deploy / GSC tasks still unchecked | Ops         | Founder                              |
| Baseline click count wording differs (`seo.md` = 2 vs catalog = 0) | Docs        | Coding agent                         |
| No `/for` collection hub (only two audience pages)                 | Optional    | Decide later                         |
| Shared default OG image across SEO articles                        | Optional    | Decide later                         |
| No `aggregateRating`                                               | Blocked     | Wait for real public reviews on-page |
| New GSC clusters since June 2026 not yet mapped                    | Data-driven | After Phase 2 export                 |

No primary landing page from the recommendation table is missing.

---

## Phase 1 — Website execution (coding agent)

**Goal:** Close internal-discovery gaps for already-shipped near-win URLs. Small, reviewable PR. No new speculative pages.

### 1.1 Footer near-win links

**File:** `components/marketing/MarketingFooter.tsx`

Add marketing-nav links (GSC-matched anchors) for URLs that exist and are in the recommendation map / near-win checklist but are missing from the footer:

| Href                                                            | Suggested anchor                         |
| --------------------------------------------------------------- | ---------------------------------------- |
| `/features/mobile-scheduling-for-cleaners`                      | Mobile app for cleaning employees        |
| `/help/cleaning-businesses/schedule-cleaning-crews`             | Schedule cleaning crews                  |
| `/help/cleaning-businesses/dispatch-vs-scheduling-for-cleaners` | Dispatch software for cleaning companies |
| `/compare/vs-launch27`                                          | Launch27 alternative                     |

Keep the existing footer density pattern (flat link list). Do not introduce cards, pill clusters, or a second footer composition.

### 1.2 Doc baseline alignment

**Files:** `docs/marketing/seo.md`, `lib/admin/seoTaskCatalog.ts` (`monitor-gsc-query-export` detail)

Align the documented baseline to one source of truth (prefer `seo.md`: ~178 impressions, **2** clicks, June 2026 28-day window) so monthly monitoring compares against a single number.

### 1.3 Cross-link hygiene (only if missing)

Before shipping Phase 1, spot-check `relatedLinks` on:

- `/features/mobile-scheduling-for-cleaners`
- `/help/cleaning-businesses/schedule-cleaning-crews`
- `/help/cleaning-businesses/dispatch-vs-scheduling-for-cleaners`
- `/compare/vs-launch27`

If a page lacks at least two sibling links using GSC-matched anchors, add them in `lib/marketing/seoContent/*` per the existing publish checklist (`docs/marketing/seo.md` → Adding new SEO pages).

### 1.4 Out of scope for Phase 1

- New feature / audience / compare / help pages
- `/for` hub or ItemList JSON-LD
- Per-page OG images
- `aggregateRating`
- Changes to robots, canonical policy, or noindex rules
- Search Console actions (Phase 2)

### Phase 1 acceptance

```bash
npm run format
npm run lint
npm run lint:styles
npm run typecheck
npm test -- lib/marketing/seoJsonLd.test.ts lib/admin/seoTasks.test.ts
```

Manual: load homepage footer on desktop + mobile; confirm four new links resolve to 200s on the apex host.

---

## Phase 2 — Founder / GSC ops (manual)

Execute via **Admin → SEO** (`admin.<apex>/seo`). Task IDs live in `lib/admin/seoTaskCatalog.ts`. Coding agents cannot complete these steps.

### 2.1 Post-deploy validation (one-time)

| Task id                      | Action                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `post-deploy-rich-results-*` | Rich Results Test on `/`, `/pricing`, Launch27 compare, Stripe feature, commercial-accounts help |
| `post-deploy-www-redirect`   | `curl -sI https://www.cleanscheduler.com/` → 308 to apex                                         |
| `post-deploy-canonical-tags` | Spot-check live HTML canonicals; confirm `/marketing/help/...` 308s                              |

### 2.2 Request indexing (one-time)

| Task id                       | URLs                                                                        |
| ----------------------------- | --------------------------------------------------------------------------- |
| `gsc-indexing-features-hub`   | `/features`, Stripe, scheduling, crew/timekeeping, mobile, invoicing        |
| `gsc-indexing-audience-pages` | `/for/commercial-cleaning-companies`, `/for/residential-cleaning-companies` |
| `gsc-indexing-compare-pages`  | `/compare/spreadsheets-and-texts`, `/compare/vs-launch27`                   |
| `gsc-indexing-help-guides`    | commercial accounts, schedule crews, dispatch vs scheduling                 |

Also complete all `near-win-*` verify-live-copy tasks after Phase 1 deploys.

### 2.3 Ongoing monitoring (recurring)

| Cadence   | Task ids                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------ |
| Monthly   | `monitor-gsc-query-export`, `monitor-gsc-coverage`, `monitor-gsc-top-queries`, `monitor-sitemap` |
| Quarterly | `monitor-rich-results-quarterly`                                                                 |

After the first monthly export post–Phase 1, update the GSC mapping table in `docs/marketing/seo.md` if positions move into 1–20 or new clusters appear with meaningful impressions.

---

## Phase 3 — Data-driven content (later)

Only after Phase 2 yields a fresh GSC export (target: 6–8 weeks from the June 2026 baseline, or the next monthly export—whichever comes first).

### Rules

1. **No speculative pages.** New URLs require a query cluster with impressions and a clear product fit.
2. Follow `docs/marketing/seo.md` → Adding new SEO pages (content file → sitemap registration → metadata → JSON-LD → `relatedLinks` → tests).
3. Add a `near-win-*` catalog task when a page targets a new priority cluster.
4. Still **do not** add `aggregateRating` until real public reviews are shown on-page.

### Optional backlog (needs explicit go-ahead)

| Item                           | Why it might help                                 | Risk                                |
| ------------------------------ | ------------------------------------------------- | ----------------------------------- |
| `/for` hub + ItemList JSON-LD  | Collection signal like `/features` and `/compare` | Extra surface without proven demand |
| Unique OG images for near-wins | Stronger social/share previews                    | Design + asset work                 |
| Additional audience segments   | Only if GSC shows non-covered segment demand      | Dilution if thin                    |

These are **not** approved by this plan. Call them out in a follow-up PR description if pursuing.

---

## Execution order

```
Phase 1 (code) ──deploy──► Phase 2 (GSC checklist) ──6–8 weeks──► Phase 3 (content from data)
     │                              │
     │                              └── monthly monitor loop (admin /seo)
     └── keep relatedLinks + footer in sync when adding pages later
```

**Suggested next coding job after this plan merges:** implement Phase 1 only (footer links + baseline doc alignment + relatedLinks spot-check).

---

## How to add work later (publish checklist)

When Phase 3 (or any future SEO page) ships:

1. Content in `lib/marketing/seoContent/`
2. Registered so `getAllPublicSeoPaths()` includes it
3. Metadata via `buildPageMetadata` / `buildMarketingPageMetadata`
4. JSON-LD via `SeoMarketingPage` or `HelpGuideArticle`
5. `relatedLinks` on ≥2 siblings with GSC-matched anchors
6. Extend `seoJsonLd.test.ts` if schema shape changes
7. Footer/nav link only if it is a near-win / priority URL
8. Founder: GSC URL Inspection + check off admin catalog tasks

---

## Ambiguities / decisions needed

Flagged for PR review — do not invent answers in code until confirmed:

1. **Baseline clicks:** Prefer `seo.md` (2 clicks, June 2026) over catalog detail (“0 clicks, July 2026”) when aligning docs in Phase 1?
2. **`/for` hub:** Build in a later optional phase, or skip until GSC shows demand for more audience pages?
3. **Footer density:** Four additional near-win links OK, or prefer a smaller subset (e.g. mobile + Launch27 only)?
4. **Phase 1 in this PR vs follow-up:** This document is the deliverable; Phase 1 website edits can land in a separate focused PR unless reviewers want them combined.

---

## Related docs

| Doc                                             | Role                                        |
| ----------------------------------------------- | ------------------------------------------- |
| `docs/marketing/seo.md`                         | Architecture + GSC mapping + publish how-to |
| `docs/product/platform-seo-tasks.md`            | Admin checklist product doc                 |
| `docs/product/implementation-status-summary.md` | Handoff snapshot                            |
| `lib/admin/seoTaskCatalog.ts`                   | Executable ops task definitions             |
