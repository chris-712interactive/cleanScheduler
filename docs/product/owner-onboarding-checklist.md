# Owner onboarding checklist — persistent setup guide

**Status:** Implemented (2026-05-21) — decisions confirmed below.

This document specs a **server-persisted getting-started checklist** for new tenant workspaces. It replaces the current dashboard-only checklist whose dismiss state lives in `localStorage` and disappears until all required steps are auto-detected complete.

Related code today:

- Checklist logic: `lib/tenant/ownerOnboardingChecklist.ts`
- Dashboard UI: `app/tenant/OwnerOnboardingPanel.tsx`
- Post-signup survey: `app/tenant/OwnerOnboardingSurveyPanel.tsx`
- Dashboard wiring: `app/tenant/page.tsx`

---

## Goals

1. **Same device or new browser** — progress and dismiss/snooze state follow the workspace in Postgres.
2. **Always findable** — owners can reopen “Getting started” from the dashboard or nav until required steps are done.
3. **Honest progress** — step completion stays **data-driven** (counts / flags in existing tables), not self-reported clicks.
4. **Trial-aware** — steps match what a free-trial workspace can actually do (Connect yes, Plaid no until subscribed).
5. **Low ceremony** — no forced modal wizard; keep the checklist pattern, make it durable and discoverable.

---

## Problems with today

| Issue                 | Today                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| Dismiss persistence   | `localStorage` key `owner-onboarding-dismissed:{tenantId}` — lost on new device, cleared storage, incognito |
| Rediscovery           | No nav entry; dismissed panel is gone with no way back                                                      |
| Snooze                | Not supported — only dismiss or complete-all                                                                |
| Business profile step | “Complete” if `tenants.name` is set — always true after signup                                              |
| Trial mismatch        | Optional “Connect bank” (Plaid) shown during trial when `plaidReconciliation` is blocked                    |
| Survey vs checklist   | Separate panels; survey also uses `localStorage` dismiss                                                    |

---

## Non-goals (this spec)

- Multi-step modal wizard blocking the app
- Product tours / tooltips (e.g. Intercom-style)
- Employee/viewer onboarding (owners + admins only, same as today)
- Replacing marketing signup (`/start-trial`)

---

## User experience

### Primary surface — dashboard card

During active setup, the dashboard uses a **compact two-column layout** (at `lg+` viewports):

- **Main column:** “Next up” hero with the next 1–2 incomplete required steps and a primary CTA; today’s queue (inline empty state when quiet).
- **Side column:** Setup progress card (visible progress bar, snooze/dismiss, link to full checklist) and compact “At a glance” stat rows (counts only — no duplicate CTAs).

The full checklist remains on **`/getting-started`**. The dashboard card is hidden when the owner snoozes or dismisses it (`uiState` not `visible`); nav badge and dedicated page stay available.

Previously the dashboard showed the full checklist card plus a duplicate “Free trial” card — both removed in favor of layout trial banner + compact dashboard surfaces.

**Actions on the progress card:**

| Action                  | Behavior                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------- |
| **Continue** (implicit) | Tap any step link → go to target route                                                 |
| **Snooze 7 days**       | Set `checklist_snoozed_until` → hide card until date; nav badge remains                |
| **Dismiss**             | Set `checklist_dismissed_at` → hide card; nav entry “Getting started” stays with badge |

When all **required** steps are auto-complete → set `checklist_completed_at`, hide card and nav badge, optional one-time “You’re set up” toast (nice-to-have).

### Secondary surface — dedicated page

**`/getting-started`** (or `/onboarding/checklist`)

- Full checklist (required + optional)
- Progress bar + “X of Y required complete”
- Same snooze/dismiss controls with copy explaining they can return via sidebar
- Deep links for each step
- Optional steps: **Skip** (persisted per step)

This page is linked from:

- Sidebar nav item **Getting started** (with badge = incomplete required count)
- Dashboard card footer: “View full checklist”
- Settings hub (optional link under Business)

### Nav badge

For owners/admins while `!checklist_completed_at`:

```
Getting started   [3]
```

Badge = count of incomplete **required** steps. Hidden when complete or workspace is suspended (`trial_expired` / billing hub only).

### Relationship to post-signup survey

Keep **`OwnerOnboardingSurveyPanel`** separate for now, but **persist survey dismiss** the same way (see schema below) so behavior is consistent.

---

## Checklist steps (proposed)

Steps are defined in code (`OWNER_ONBOARDING_STEPS` constant). Completion is computed on each request from DB counts unless overridden by a manual skip (optional steps only).

### Required (trial-friendly)

| ID         | Title                     | Complete when                                                                                        | Route                    |
| ---------- | ------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------ |
| `business` | Complete business profile | `tenants.timezone` set **and** (`business_email` or `business_phone`) **and** address line 1 or city | `/settings/business`     |
| `quote`    | Create your first quote   | ≥1 non-superseded quote                                                                              | `/quotes/new`            |
| `customer` | Add a customer            | ≥1 active customer                                                                                   | `/customers/new`         |
| `visit`    | Schedule a visit          | ≥1 scheduled visit                                                                                   | `/schedule/new`          |
| `connect`  | Set up online payments    | `tenants.stripe_connect_status = complete`                                                           | `/billing/payment-setup` |
| `invoice`  | Send a customer invoice   | ≥1 invoice (any status except void)                                                                  | `/billing/invoices/new`  |
| `team`     | Invite a teammate         | >1 active membership **or** pending invite                                                           | `/employees/new`         |

**Removed from required vs today:** none — same seven concepts, stricter `business` detection.

### Optional

| ID              | Title                           | Complete when                  | Trial                                            | Route                      |
| --------------- | ------------------------------- | ------------------------------ | ------------------------------------------------ | -------------------------- |
| `portal_invite` | Invite a customer to the portal | ≥1 customer portal invite sent | Yes                                              | `/customers` (with hint)   |
| `compensation`  | Set compensation rules          | ≥1 active compensation rule    | Yes                                              | `/settings/compensation`   |
| `bank`          | Connect your bank (Plaid)       | ≥1 active bank link            | **No** — show locked until `plaidReconciliation` | `/billing/bank-connection` |

**Changes from today:**

- Add **`portal_invite`** — key trial eval feature (customer portal).
- **`bank`** — during trial: show as locked with “Available on Business after you subscribe” + link to `/billing`; not counted in required progress; optional skip still allowed after subscribe.
- **`compensation`** — remains optional; skip allowed.

### Subscribe step (conditional)

When `subscriptionAccess === 'trialing'` and trial ends within **3 days** (or `trial_expired`):

| ID          | Title                           | Route      |
| ----------- | ------------------------------- | ---------- |
| `subscribe` | Choose a plan before trial ends | `/billing` |

Inserted at top of list; **required for checklist completion only while trial is active/expired without subscription** — does not block portal access (billing page handles that).

---

## Persistence model

### Option A — columns on `tenant_onboarding_profiles` (recommended)

Migration adds:

```sql
alter table public.tenant_onboarding_profiles
  add column checklist_dismissed_at timestamptz,
  add column checklist_snoozed_until timestamptz,
  add column checklist_completed_at timestamptz,
  add column checklist_optional_skips text[] not null default '{}',
  add column survey_dismissed_at timestamptz;
```

| Column                     | Meaning                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `checklist_dismissed_at`   | Owner dismissed dashboard card (can still open `/getting-started`) |
| `checklist_snoozed_until`  | Hide dashboard card until this timestamp                           |
| `checklist_completed_at`   | All required steps done; stop showing nav badge                    |
| `checklist_optional_skips` | Step IDs user skipped (`compensation`, `portal_invite`, etc.)      |
| `survey_dismissed_at`      | Post-signup survey dismissed without submitting                    |

**UI visibility rule (dashboard card):**

```text
showCard =
  role is owner/admin
  AND NOT checklist_completed_at
  AND NOT (checklist_snoozed_until > now())
  AND NOT checklist_dismissed_at
  AND subscriptionAccess allows portal (not trial_expired-only billing lockout — card can show on billing page embed optional)
```

**Nav badge rule:**

```text
showNav =
  role is owner/admin
  AND NOT checklist_completed_at
  AND incompleteRequiredCount > 0
```

**Completion write:** when `incompleteRequiredCount === 0`, server sets `checklist_completed_at = now()` (idempotent).

### Option B — separate `tenant_onboarding_checklist_events` audit table

Only if we need analytics (“time to first quote”). Defer unless product wants funnel metrics in v1.

---

## API / server actions

| Action                                  | Who          | Effect                                                |
| --------------------------------------- | ------------ | ----------------------------------------------------- |
| `snoozeOwnerChecklist({ days: 7 })`     | owner, admin | `checklist_snoozed_until = now + days`                |
| `dismissOwnerChecklist()`               | owner, admin | `checklist_dismissed_at = now()`                      |
| `skipOptionalChecklistStep({ stepId })` | owner, admin | append to `checklist_optional_skips` if step.optional |
| `reopenOwnerChecklist()`                | owner, admin | clear `checklist_dismissed_at`, clear snooze          |
| `dismissOwnerSurvey()`                  | owner, admin | `survey_dismissed_at = now()`                         |

All actions: `requireTenantPortalAccess` + `canManageTeamInvitesAndRoles`.

**No action to manually mark required steps complete** — prevents gaming progress.

---

## Code structure (implementation)

```
lib/tenant/ownerOnboardingChecklist.ts   — step defs, completion eval, merge skips/locks
lib/tenant/ownerOnboardingState.ts     — read/write profile checklist columns
app/tenant/getting-started/page.tsx    — full checklist page
app/tenant/ownerOnboardingActions.ts   — server actions above
app/tenant/OwnerOnboardingPanel.tsx      — update: snooze, dismiss → server actions
components/portal/...                  — nav badge in TenantLayout
```

Refactor `getOwnerOnboardingChecklist` to accept:

```ts
getOwnerOnboardingChecklist(db, {
  tenantId,
  connectStatus,
  billingAccess, // trialing | active | ...
  entitlementPlan, // trial | starter | ...
  profileState, // dismiss/snooze/skips from DB
});
```

Return:

```ts
interface OwnerOnboardingChecklist {
  steps: OwnerOnboardingStep[]; // add locked?: boolean; lockedReason?: string
  completedCount: number;
  totalRequired: number;
  allRequiredComplete: boolean;
  uiState: 'visible' | 'dismissed' | 'snoozed' | 'complete';
  snoozedUntil: string | null;
}
```

---

## Trial & entitlement integration

| Step                        | Trialing                    | Subscribed           |
| --------------------------- | --------------------------- | -------------------- |
| Connect                     | Show, completable           | Same                 |
| Invoice / quotes / schedule | Show, completable           | Same                 |
| Bank (Plaid)                | Locked — link to `/billing` | Show if Business+    |
| Subscribe                   | Show when trial ending      | Hidden when `active` |

Use `resolveTenantEntitlementPlan()` and `resolveTenantSubscriptionAccess()` — same patterns as billing gates.

---

## Migration & backfill

**Existing workspaces:**

| Case                              | Behavior                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Already completed all steps today | On first load after deploy, cron or lazy eval sets `checklist_completed_at`                           |
| Dismissed in localStorage only    | Treat as not dismissed server-side; optionally one-time banner “Getting started moved to the sidebar” |
| Active mature tenants             | If all required steps already true, backfill `checklist_completed_at` so they never see checklist     |

Backfill script (one-time):

```sql
-- Pseudocode: mark complete where quotes+customers+visits+invoices+connect already exist
-- Run via admin script or migration DO block with conservative criteria
```

---

## Implementation phases

| Phase | Scope                                                                        |
| ----- | ---------------------------------------------------------------------------- |
| **1** | Migration + `ownerOnboardingState` read/write + server actions               |
| **2** | Refactor checklist eval (business profile, trial locks, subscribe step)      |
| **3** | Update `OwnerOnboardingPanel` (snooze/dismiss → server); remove localStorage |
| **4** | `/getting-started` page + sidebar nav + badge                                |
| **5** | Persist survey dismiss; polish copy                                          |
| **6** | Backfill `checklist_completed_at` for mature tenants                         |

---

## Open decisions (please confirm)

### 1. Dedicated page URL

- **A.** `/getting-started` — **recommended**
- **B.** `/onboarding`
- **C.** Dashboard only (no dedicated page)

### 2. Snooze duration

- **A.** Fixed 7 days — **recommended**
- **B.** Owner picks 1 / 7 / 30 days
- **C.** No snooze — dismiss only

### 3. Dismiss behavior

- **A.** Dismiss hides dashboard card only; nav + `/getting-started` remain — **recommended**
- **B.** Dismiss hides everything until a step completes (auto resurface)

### 4. `portal_invite` step

- **A.** Add as optional step — **recommended**
- **B.** Skip for v1

### 5. Subscribe step near trial end

- **A.** Show required checklist row when ≤3 days left or trial expired — **recommended**
- **B.** Rely on existing trial banner only; no checklist row

### 6. Who sees the checklist

- **A.** Owner + admin (current) — **recommended**
- **B.** Owner only

### 7. Completion celebration

- **A.** Silent (nav badge disappears) — **recommended for v1**
- **B.** One-time dashboard toast / confetti card

### 8. Backfill mature tenants

- **A.** Auto-complete if all required steps already true — **recommended**
- **B.** Show checklist to everyone until they dismiss

---

## Success metrics (optional, post-launch)

- Median time from signup → first quote / customer / visit
- % workspaces with `checklist_completed_at` within 7 days
- Drop-off per step ID (requires event table — phase 2 analytics)

---

## References

- Free trial entitlements: `docs/billing/free-trial-spec.md`
- Connect setup: `/billing/payment-setup`
- Current checklist: `lib/tenant/ownerOnboardingChecklist.ts`
