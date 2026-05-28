# Interaction latency — performance assessment & implementation plan

**Date:** 2026-05-28  
**Scope:** cleanScheduler portal UX (tenant, customer, admin) — click-to-response lag  
**Status:** Assessment complete; implementation not started

---

## Executive summary

Users experience lag between clicks and visible UI updates. Investigation shows this is **not primarily a bundle-size or React rendering problem**. It is an **architecture stacking problem**:

1. Every navigation and most button clicks trigger a **full server render** (`force-dynamic` layouts + pages).
2. Portal layouts run **8–15 Supabase queries** before page content even starts.
3. Server actions often **invalidate the entire layout** (`revalidatePath(..., 'layout')`) and then **client code calls `router.refresh()`**, refetching the layout again.
4. There are **zero `loading.tsx` or `Suspense` boundaries**, so the UI appears frozen until the full RSC payload returns.

The fastest path to noticeably snappier interactions is a **three-phase plan**: (1) stop over-invalidation and double-refresh, (2) add instant loading feedback and dedupe layout queries, (3) optimistic updates on high-frequency interactions (Quotes Kanban, schedule).

**Expected impact after Phase 1–2:** 30–50% reduction in perceived click latency on tenant portal; customer nav improved by replacing full quote list fetch with a count query.

---

## Problem statement

| Symptom                                         | User impact                  |
| ----------------------------------------------- | ---------------------------- |
| Sidebar link click → long pause before new page | Navigation feels sluggish    |
| Form submit / button → spinner then freeze      | Actions feel unresponsive    |
| Quotes Kanban drag → delay before card moves    | Drag-and-drop feels broken   |
| Schedule day change → full page stall           | Calendar navigation is heavy |

**Goal:** Sub-200ms **perceived** feedback on every click (loading skeleton or optimistic UI), and **<1s** time-to-interactive for common navigations on a warm connection.

---

## How we assessed

Code review of:

- Portal layouts (`app/tenant/layout.tsx`, `app/customer/layout.tsx`, `app/admin/layout.tsx`)
- Middleware (`middleware.ts`)
- Server action + revalidation patterns (`revalidatePath`, `router.refresh`)
- Client interaction hooks (`useRefreshOnServerActionSuccess`)
- High-traffic pages (quotes, schedule, customers)
- Supabase client configuration (`lib/supabase/server.ts`)
- Loading/streaming primitives (`loading.tsx`, `Suspense`) — **none found**

No production APM traces were available for this assessment. Recommendations include **measurement hooks** in Phase 0 so fixes are validated with data.

---

## Architecture context (relevant to latency)

```
Click / navigation
    │
    ▼
middleware.ts          ← auth.getUser() + membership + subscription (tenant)
    │
    ▼
layout.tsx (force-dynamic)   ← 8–15 DB queries, banners, nav badges
    │
    ▼
page.tsx (force-dynamic)     ← page-specific queries (often 2–6 more)
    │
    ▼
RSC payload → browser      ← no streaming shell; user sees nothing until done

Server action click
    │
    ▼
Server action handler    ← DB writes
    │
    ▼
revalidatePath('layout') ← invalidates entire portal shell
    │
    ▼
useRefreshOnServerActionSuccess → router.refresh()  ← full refetch again
```

---

## Findings

### F1 — Global `force-dynamic` disables caching (Critical)

**Evidence:** `export const dynamic = 'force-dynamic'` on:

- All three portal layouts (`app/tenant/layout.tsx:37`, `app/customer/layout.tsx:14`, `app/admin/layout.tsx`)
- **~50+ page routes** including quotes, schedule, customers, billing

**Impact:** Every `<Link>` navigation and every `router.refresh()` triggers a **complete SSR round trip**. No static shell, no ISR, no partial cache.

**Why it exists:** Portals are auth-gated and tenant-scoped — correct for security, but currently applied at the **widest** scope (entire layout tree).

---

### F2 — Tenant layout is a query waterfall on every navigation (Critical)

**File:** `app/tenant/layout.tsx`

On **every** tenant navigation, the layout sequentially/parallel-fetches:

| Step         | Work                                                                                 |
| ------------ | ------------------------------------------------------------------------------------ |
| Access       | `requireTenantPortalAccess()` → `getUser()` + membership lookup + subscription check |
| Auth (again) | `getAuthContext()` → **second `getUser()`**                                          |
| Masquerade   | `expireStaleMasqueradeIfNeeded()` (possible write)                                   |
| Billing      | `tenants` + `tenant_billing_accounts`                                                |
| Profile      | `user_profiles` for identity chip                                                    |
| Nav badge    | `countPendingRescheduleRequests()`                                                   |
| Entitlements | `resolveTenantEntitlementPlan()`                                                     |
| Usage banner | `loadTenantUsageUtilizationAlert()` (conditional)                                    |
| Onboarding   | `loadOwnerOnboardingNavContext()` (multi-query)                                      |

**Impact:** Layout alone can account for **300–800ms+ TTFB** before the page component runs. Middleware already resolves membership and subscription for tenant routes — **duplicate work**.

---

### F3 — Double refresh after server actions (Critical)

**Pattern A — layout revalidation:**

```typescript
// Example: app/tenant/quotes/actions.ts
revalidatePath('/tenant', 'layout');
revalidatePath('/tenant/quotes', 'page');
```

**19 call sites** use `revalidatePath(..., 'layout')` across quotes, customers, schedule, settings, and customer portal actions.

**Pattern B — client refresh hook:**

```typescript
// lib/hooks/useRefreshOnServerActionSuccess.ts
router.refresh(); // on every { success: true }
```

Used in **16 client forms** (schedule, customers, quotes, settings, customer quote response).

**Pattern C — imperative refresh:**

```typescript
// app/tenant/quotes/QuotesBoard.tsx
router.refresh(); // after Kanban drag
```

**Impact:** A single button click can cause:

1. Server action execution
2. Full layout invalidation + refetch (revalidatePath)
3. Another full RSC refetch (router.refresh)

Users wait for **2× layout work** plus page work, with **no intermediate UI**.

---

### F4 — No loading or streaming boundaries (High)

**Evidence:**

- **0** `loading.tsx` files in the repo
- **0** `Suspense` boundaries in app/components
- `Skeleton` component exists (`components/ui/Skeleton.tsx`) but is **not used** for route transitions

**Impact:** During SSR, the previous page stays visible (or frozen) until the entire new tree is ready. This is the primary driver of **“nothing happened when I clicked.”**

---

### F5 — Customer layout fetches full quote list for a badge (High)

**File:** `app/customer/layout.tsx:53–56`

```typescript
const { rows: quoteRows } = ctx
  ? await fetchCustomerQuoteList(admin, ctx.customerIds)
  : { rows: [] };
const pendingQuoteCount = pendingCustomerQuotes(quoteRows).length;
```

`fetchCustomerQuoteList` loads **all non-draft quotes with tenant joins** on every customer navigation, only to count pending items for a nav badge.

**Impact:** Multi-tenant customers with long quote history pay a large layout tax on **every** page click.

---

### F6 — Middleware adds latency before RSC runs (Medium)

**File:** `middleware.ts`

Per matched request:

- Host classification + URL rewrite
- `resolveUser()` → Supabase `auth.getUser()` with `cache: 'no-store'`
- Tenant routes: membership + subscription resolution (parallel, but still 2+ DB round trips)
- White-label customer hosts: `resolveActiveWhiteLabelCustomerPortal()` (additional DB)

**Impact:** Fixed overhead on **every** navigation, duplicated again in layout auth.

---

### F7 — Supabase reads are never HTTP-cached (Medium)

**File:** `lib/supabase/server.ts:31–35`

All server Supabase fetches use `cache: 'no-store'`. Correct for auth-bound data, but means **every query is a network round trip** with no request-level deduplication unless wrapped in `React.cache()`.

**Impact:** Multiple calls to `createAdminClient()` and repeated membership/billing lookups within one request are not deduped.

---

### F8 — Heavy client islands without code splitting (Medium)

| Component         | File                                           | Notes                                                              |
| ----------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| Quotes Kanban     | `app/tenant/quotes/QuotesBoard.tsx`            | Full `'use client'` board + `@dnd-kit/core`; no optimistic updates |
| Schedule timeline | `app/tenant/schedule/TenantScheduleClient.tsx` | Date/view changes use `router.push` → full page SSR                |
| Quote line editor | `app/tenant/quotes/QuoteLineItemsEditor.tsx`   | ~490 lines client state                                            |
| Global search     | `components/portal/GlobalSearch.tsx`           | Loaded in tenant layout TopBar for all pages                       |

**No `next/dynamic()` usage found** — heavy modules load with their route chunks unconditionally.

**Note:** FullCalendar is **not** used (custom schedule grid). pdfkit is server-only (reports/invoices) — not click-path weight.

---

### F9 — Admin portal is comparatively fast (Baseline)

**File:** `app/admin/layout.tsx`

Light layout: `requirePortalAccess('admin')` + static nav. Useful as a **performance baseline** — if admin feels snappy and tenant/customer do not, layout query depth is confirmed as the differentiator.

---

## Root cause synthesis

```mermaid
flowchart LR
  subgraph click [User click]
    Nav[Nav link]
    Action[Form / button]
    Drag[Kanban drag]
  end

  subgraph server [Server cost]
    MW[Middleware auth + DB]
    Layout[Layout 8-15 queries]
    Page[Page queries]
    SA[Server action]
    Rev[revalidatePath layout]
  end

  subgraph client [Client cost]
    Refresh[router.refresh]
    NoLoad[No loading UI]
  end

  Nav --> MW --> Layout --> Page
  Action --> SA --> Rev --> Refresh
  Rev --> Layout
  Refresh --> Layout
  Layout --> NoLoad
  Page --> NoLoad
  Drag --> SA --> Refresh
```

**Primary bottleneck:** Layout SSR + over-invalidation + no perceived feedback.  
**Secondary bottleneck:** Duplicate auth/DB between middleware and layout.  
**Tertiary bottleneck:** Heavy client bundles on quotes/schedule routes (TTI/hydration).

---

## Implementation plan

### Phase 0 — Measure (3–5 days)

Establish baselines before changing behavior.

| Task                     | Detail                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| Add Web Vitals reporting | `instrumentation.ts` or Vercel Speed Insights; track LCP, INP on tenant/customer           |
| Server timing logs       | Optional `console.time` behind `DEBUG_PERF=1` in layout + middleware for dev               |
| Document targets         | Nav click p95 < 1s TTFB; action feedback < 100ms perceived                                 |
| Pick 5 critical flows    | Quotes board drag, customer create, visit complete, nav to schedule, customer quote accept |

**Exit criteria:** Baseline numbers recorded for the 5 flows in dev/staging.

---

### Phase 1 — Quick wins: stop doing redundant work (1 sprint)

**Goal:** Reduce work per click without architectural rewrites.

#### 1.1 Unify refresh strategy (High impact, Low effort)

| Change                                                                                      | Files                                                           |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Remove redundant `router.refresh()` where `revalidatePath` already targets the correct page | All 16 `useRefreshOnServerActionSuccess` consumers — audit each |
| **Never** combine `revalidatePath(..., 'layout')` + `router.refresh()` for the same action  | quotes, customers, schedule actions                             |
| Kanban: remove `router.refresh()` on success; rely on page revalidation only                | `QuotesBoard.tsx`                                               |

**Rule:** One invalidation mechanism per action — prefer **narrow `revalidatePath('/tenant/quotes', 'page')`** over layout.

#### 1.2 Narrow revalidation scope (High impact, Low effort)

Replace layout-wide invalidation:

```typescript
// Before
revalidatePath('/tenant', 'layout');

// After (example: quote status change)
revalidatePath('/tenant/quotes', 'page');
revalidateTag('tenant-nav-badges'); // see Phase 2
```

**Priority files (19 layout revalidation call sites):**

- `app/tenant/quotes/actions.ts` (4×)
- `app/tenant/customers/actions.ts` (2×)
- `app/tenant/schedule/actions.ts` (2×)
- `app/customer/quotes/actions.ts` (2×)
- `app/tenant/settings/*` actions

#### 1.3 Add route loading shells (High perceived impact, Low effort)

Add `loading.tsx` with existing `Skeleton` / layout-aware placeholders:

```
app/tenant/loading.tsx
app/tenant/quotes/loading.tsx
app/tenant/schedule/loading.tsx
app/tenant/customers/loading.tsx
app/customer/loading.tsx
```

**Exit criteria:** Clicking nav shows skeleton within 1 frame; no “dead click” feeling.

#### 1.4 Customer layout: count-only quote badge (Medium impact, Low effort)

Replace `fetchCustomerQuoteList` in layout with:

```sql
SELECT count(*) FROM tenant_quotes
WHERE customer_id = ANY($1)
  AND status = 'sent'
  AND superseded_by_quote_id IS NULL
```

New helper: `lib/customer/pendingCustomerQuoteCount.ts`.

**File:** `app/customer/layout.tsx`

#### 1.5 Dedupe auth in tenant layout (Medium impact, Low effort)

`requireTenantPortalAccess` and `getAuthContext` both call `getUser()`. Refactor to return auth context from access check, or wrap both in `React.cache()` per request.

**Files:** `lib/auth/tenantAccess.ts`, `lib/auth/session.ts`, `app/tenant/layout.tsx`

---

### Phase 2 — Request-scoped data layer (1–2 sprints)

**Goal:** Layout runs once per request with deduped queries; nav badges update without full layout invalidation.

#### 2.1 `React.cache()` portal context

Wrap in `React.cache()`:

- `requireTenantPortalAccess`
- `getAuthContext`
- `resolveTenantEntitlementPlan`
- `resolveTenantSubscriptionAccess` (from billing row)

Single import: `lib/portal/requestContext.ts`.

#### 2.2 Tag-based revalidation for nav chrome

Introduce cache tags:

| Tag                    | Invalidated when                    |
| ---------------------- | ----------------------------------- |
| `tenant-nav-badges`    | Reschedule request created/resolved |
| `tenant-onboarding`    | Checklist step completed            |
| `tenant-usage`         | Usage rollup cron / limit change    |
| `customer-quote-badge` | Quote sent/accepted/declined        |

Layout subcomponents fetch badge data with `unstable_cache` + tags; pages no longer need `'layout'` revalidation for badge updates.

#### 2.3 Middleware → layout snapshot (optional)

Pass membership + subscription summary via request headers set in middleware; layout reads headers instead of re-querying. Requires careful typing and test coverage.

#### 2.4 Dynamic import heavy client modules

```typescript
const QuotesBoard = dynamic(() => import('./QuotesBoard'), {
  loading: () => <QuotesBoardSkeleton />,
});
```

Apply to: `QuotesBoard`, `GlobalSearch`, `QuoteLineItemsEditor`.

---

### Phase 3 — Interaction-native updates (2 sprints)

**Goal:** High-frequency interactions do not round-trip through full RSC.

#### 3.1 Quotes Kanban — optimistic UI

- On drag end: update local column state immediately
- Fire `moveTenantQuoteStatus` in background
- Roll back on error; toast on failure
- Remove post-action refresh entirely

**File:** `app/tenant/quotes/QuotesBoard.tsx`

#### 3.2 Schedule — client-side date navigation

- Keep visit data in client state for current week/day view
- Fetch new date range via Route Handler or server action returning **JSON** (not RSC)
- Avoid `router.push` for in-calendar prev/next day

**Files:** `TenantScheduleClient.tsx`, new `app/api/tenant/schedule/visits/route.ts`

#### 3.3 Server actions return updated DTOs

Pattern:

```typescript
// Return { success: true, quote: updatedRow } instead of relying on refresh
```

Forms update local display from action result; revalidate only on cache miss.

---

### Phase 4 — Structural layout split (long-term)

**Goal:** Static portal chrome + dynamic slots.

| Approach               | Detail                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Split layout           | Static `PortalShell` frame; dynamic `<NavBadges />`, `<SessionBanners />` as separate async server components wrapped in `Suspense` |
| Reduce `force-dynamic` | Layout shell can be dynamic; badge/banner slots stream in                                                                           |
| PPR / streaming        | When Next.js PPR is stable for auth-gated apps, evaluate for marketing + public pages first                                         |
| White-label cache      | Edge cache for `host → tenant` mapping (short TTL)                                                                                  |

---

## Priority matrix

| #   | Item                                              | Impact               | Effort  | Phase |
| --- | ------------------------------------------------- | -------------------- | ------- | ----- |
| 1   | Add `loading.tsx` to tenant + customer portals    | Perceived latency    | Low     | 1     |
| 2   | Stop double refresh (revalidate + router.refresh) | Action latency       | Low     | 1     |
| 3   | Narrow `revalidatePath` away from `'layout'`      | Action + nav latency | Low     | 1     |
| 4   | Customer layout count-only quote badge            | Customer nav         | Low     | 1     |
| 5   | Dedupe `getUser()` in tenant layout               | Nav latency          | Low     | 1     |
| 6   | `React.cache()` request context                   | Nav latency          | Medium  | 2     |
| 7   | `revalidateTag` for nav badges                    | Action latency       | Medium  | 2     |
| 8   | Quotes Kanban optimistic updates                  | Drag latency         | Medium  | 3     |
| 9   | Dynamic import heavy client routes                | TTI                  | Low–Med | 2     |
| 10  | Schedule client-side date fetch                   | Schedule nav         | Medium  | 3     |
| 11  | Split layout + Suspense streaming                 | Nav latency          | High    | 4     |
| 12  | Revisit global `force-dynamic` on layouts         | Structural           | High    | 4     |

---

## Success metrics

| Metric                                     | Baseline (est.) | Target                        |
| ------------------------------------------ | --------------- | ----------------------------- |
| Perceived click feedback                   | 0ms (frozen UI) | < 100ms (skeleton/optimistic) |
| Tenant nav TTFB (p95)                      | 800ms–2s        | < 800ms                       |
| Server action → UI update (p95)            | 1–3s            | < 1s                          |
| Layout Supabase queries per nav            | 8–15            | ≤ 4 (deduped)                 |
| `revalidatePath(..., 'layout')` call sites | 19              | 0 (replaced by tags)          |

Validate with Web Vitals **INP** (Interaction to Next Paint) on staging before/after Phase 1.

---

## Risks and tradeoffs

| Risk                                                     | Mitigation                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Stale nav badges after narrowing revalidation            | Introduce tags in Phase 2 before removing layout revalidation                |
| Middleware header snapshot drift                         | Integration tests for membership/subscription gating                         |
| Optimistic Kanban rollback UX                            | Clear error toast + automatic revert                                         |
| Removing `router.refresh()` breaks rewrite cache sync    | Test on `lvh.me` tenant subdomains; keep refresh only where proven necessary |
| `force-dynamic` removal exposes cached cross-tenant data | Never cache tenant-scoped payloads; only chrome or public marketing          |

---

## Recommended release packaging

| Release   | Contents                                                                          |
| --------- | --------------------------------------------------------------------------------- |
| **1.2.0** | Phase 0 + Phase 1 (loading shells, revalidation fix, customer count, auth dedupe) |
| **1.3.0** | Phase 2 (React.cache, revalidateTag, dynamic imports)                             |
| **1.4.0** | Phase 3 (Kanban optimistic, schedule client fetch)                                |
| **2.x**   | Phase 4 (layout streaming split)                                                  |

Aligns with post-1.1.0 hardening track; performance work can ship incrementally without blocking feature releases.

---

## Key files reference

| Area                         | Path                                           |
| ---------------------------- | ---------------------------------------------- |
| Middleware                   | `middleware.ts`                                |
| Tenant layout                | `app/tenant/layout.tsx`                        |
| Customer layout              | `app/customer/layout.tsx`                      |
| Refresh hook                 | `lib/hooks/useRefreshOnServerActionSuccess.ts` |
| Supabase server              | `lib/supabase/server.ts`                       |
| Tenant access                | `lib/auth/tenantAccess.ts`                     |
| Quotes board                 | `app/tenant/quotes/QuotesBoard.tsx`            |
| Quotes actions               | `app/tenant/quotes/actions.ts`                 |
| Schedule client              | `app/tenant/schedule/TenantScheduleClient.tsx` |
| Customer quote list          | `lib/customer/customerQuoteList.ts`            |
| Portal shell                 | `components/portal/PortalShell.tsx`            |
| Skeleton (unused for routes) | `components/ui/Skeleton.tsx`                   |

---

## Next steps

1. Review and approve phase ordering with product/engineering.
2. Create GitHub issues (or release 1.2.0 scope) from Phase 1 tasks.
3. Implement Phase 0 measurement in staging before code changes.
4. Ship Phase 1 as **release 1.2.0** — highest ROI, lowest risk.
