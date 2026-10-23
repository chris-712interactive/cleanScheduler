# Implementation status summary

**Last updated:** 2026-10-22  
**Branch:** `dev`  
**Latest polish:** A field employee can read experience, daily limits, skills, and places on Account. An owner or admin sets those, and sets who should be paired. Pairing stays off the field employee account. Fill schedule keeps a crew it has already chosen when the drive time is a fraction of a minute, and saves that start at the nearest minute. A pair starts when the later person can arrive, instead of leaving the visit open because the first minute only fits one of them. Fill schedule assigns the cleaners who can reach a job and leaves the visit short-staffed when the rest live too far away, instead of assigning nobody. The visit's assign list marks those far cleaners as too far from the location. Accepting a quote looks up a map point for that service location before anyone is scheduled, and Fill schedule does the same lookup before it assigns a crew. A location added on the quote is geocoded when the quote is saved. An open quotes board moves a card into Accepted or Declined as soon as the customer responds, and the open quote page refreshes with it. Apply migration **`0113`**. Each customer invoice keeps the service location it bills. Apply migration **`0112`**. The location is copied from the visit or quote, or from the customer's only property, and it shows on the invoice list. Customer invoices are separate cards on the page background. Page controls appear only when a second page exists, with space above them. A search box filters by invoice number, customer name, email, phone, property address, status, or amount. Today on the dashboard lists a job only while it is still scheduled. A day that is already finished stays off that list, and the jobs chart keeps the completed count. The global 404 stylesheet is part of the main CSS, so the browser no longer warns that it was preloaded and never used. Saving a job type’s schedule role as Standard keeps Standard. Trial, plan-limit, and card-payment reminders sit in one header chip instead of stacked bars. The chip shows the most urgent item, and a count opens the rest. A paused workspace and a staff masquerade session still use a full-width bar. Fill schedule keeps a biweekly clean off the day of an initial deep clean at the same street, even when the deep clean is renamed or stored on a second property record. A biweekly clean starts two weeks after that initial clean. Settings → Job types lists each property type on its own row. The closed row shows duration, minimum crew, and schedule role; opening it edits those fields and the checklists. Job types have a minimum crew. Deep cleaning starts at 2 people, and the day planner uses the higher of that minimum and the location’s crew size. Apply migration **`0111`**. Fill schedule shows the street on each visit and on anything left off, and a recurring clean follows that property's own last visit. Another property no longer makes a biweekly house look like it is not due. On Scheduling logic, the starting point you click stays filled in and a note confirms the weights below updated. Customers can open **Properties** in the portal to read the locations on their account and request another. A request creates the location and starts a consultation for that address: the office dashboard and the customer record ask to schedule the walkthrough, and a quote for that location waits until the consultation is complete when consultations are required before quotes. Apply migration **`0110`**. A home, service location, or business address with no map point is tagged **Missing map point** in the office, with the reason from the last lookup (no match, Google rejected the key, outside the US, too short, over the limit, or the service did not respond). Apply migration **`0109`**. Saving a home, service location, or business address looks the point up with Google Geocoding when `GOOGLE_MAPS_GEOCODING_API_KEY` is set, and keeps the saved point when the address text did not change. Census is the fallback. Fill schedule prefers a field employee who lives in the job’s town over one who lives in another state, using the saved city, state, and postal code when map coordinates are missing. A field employee’s Account page is one column of sections — name, hours, scheduling limits, skills, places, teammates, home, sign-in, appearance, and workspace — each closed to a one-line summary until opened. The tenant dashboard draws donut charts under the numbers: quotes by status, money collected in the last 30 days next to what is still outstanding, and today's jobs split into scheduled and completed when there are visits. A chart stays off the page when every slice is zero. The tenant dashboard shows quotes, jobs, invoices, revenue, and customers in one strip. Desktop keeps them in a single row, tablet puts money on a second row, and the phone stacks one figure per row. Today stays a short list and appears only when something needs attention. Office scheduling preferences on a customer use the same day buttons and time choices, grouped into sections that stay collapsed until opened. Customer portal Settings shows visit days as a week of buttons and time of day as choices, and the saved time stays selected. Custom scheduling for one service location lives inside that location and stays hidden until its checkbox is on. Customer scheduling preferences stay on the customer. Crew size lives on each service location. Consultations ask for it on every property type, and quotes collect it beside the priced lines. Saving either one writes the number onto that location, and the day planner assigns that many people. Apply migration **`0108`**. See `docs/product/schedule-optimizer.md` and `docs/product/quotes-line-items.md`. Fill schedule assigns crew to a visit whose preferred start was clipped to the end of the workday, when those people are free at the time already on the visit. Owners and admins can opt out of jobs, consultations, or both. Apply migration **`0107`**. Checking both hides availability and the scheduling profile. Checking only jobs leaves a shorter consultation profile. See `docs/product/schedule-optimizer.md`. Customers can set preferred days and a time of day (morning, afternoon, or evening) in portal Settings, and the office can set the same fields on the customer record. Fill schedule aims for those days inside the usual gap and uses that time of day when no tighter arrival window is saved. Apply migration **`0106`**. See `docs/product/schedule-optimizer.md`. Portal messages show the person who sent each reply, appear in the thread as soon as you send them (⌘/Ctrl + Enter also sends), notify the other side while they are signed in, and email the customer when staff replies. Apply migration **`0105`** for sender names. See `docs/product/customer-support-messaging.md`. Fill schedule places accepted quotes across a day, week, month, or date range at the customer's cadence, books consultations for new website leads, leaves a completed one-time job off the left-off list, and starts recurring cleans one full cycle after an initial one-time clean. Scheduling those visits opens a live status screen, finishes with a summary of what was placed, and can undo that run while the visits are still scheduled. Crew still comes from Scheduling logic.

Use this file as the handoff snapshot for new AI sessions. Detailed specs live under `docs/product/`; YAML todos live in `.cursor/docs/plan/implementation-plan.md`.

---

## Where we are

**v1.0.0** is in PROD. **Release 1.1.0** work continues in parallel.

**Starter competitive pack (2026-07-15):**

- GPS-verified check-in on all plans (`0082`)
- Email overdue invoice + visit reminders on all plans; SMS stays Pro (`0083`, `/api/cron/visit-reminders`)
- Lite public booking request at `{slug}/book` (`0084`, `publicBookingRequest`)
- Proof-of-service photos on all plans (portal share stays Pro)
- On-my-way + post-visit review-request emails (`0085`); Starter seats 2 office / 5 field
- Visit checklists, guest invoice pay, richer `/book`, crew Today CTAs (`0086`)
- Consultation checklists per service type + consultation notes → property site notes (`0087`)
- Service zones for CRM geography on properties; directory filter/search (`0088`)

**GPS-verified check-in (MVP)** — one-shot browser location on visit check-in; office sees proof on visit detail. Not live fleet tracking.

**Bucket B — Phase 2** is **code-complete** on `feat/bucket-b-phase2`. All four slices (B1–B4) are implemented, typecheck/lint/test/build pass, and migrations **0073 → 0074 → 0075** must be applied in order on each Supabase environment.

### Uncommitted work (local only — code-complete, pre-ship checks pass)

| Change                                  | Purpose                                          |
| --------------------------------------- | ------------------------------------------------ |
| `lib/tenant/permissionAreas.ts` + tests | Group permissions by product area for Roles UI   |
| `TenantRolesSettingsPanel.tsx` + SCSS   | Area summaries (browse) + preset controls (edit) |
| Product + plan docs                     | Synced custom-roles UX and backlog snapshot      |

`0074` trigger disable during backfill (fix `QUOTE_EXPIRED_IMMUTABLE`) is already in the committed migration.

---

## Bucket B — shipped features

### B1 — Platform support ticketing (`0073`)

| Surface                | Route                              |
| ---------------------- | ---------------------------------- |
| Founder inbox          | `/support`                         |
| Tenant ticket creation | `/settings/support`                |
| Tenant detail card     | Admin tenant page — recent tickets |

**Doc:** `docs/product/platform-support-tickets.md`

### B2 — Custom quote pipeline stages (`0074`)

- Per-tenant Kanban columns in `tenant_quote_pipeline_stages`
- Quotes board refactored to stage-based columns
- Settings at `/settings/quotes-pipeline`
- Gated by Pro+ `kanbanCustomization` entitlement

**Doc:** `docs/product/quote-pipeline-stages.md`  
**Note:** `on_enter_status` exists in DB but is not exposed in settings UI yet.

### B3 — Custom roles + permissions (`0075`)

- `tenant_roles`, `tenant_role_permissions`, `tenant_memberships.role_id`
- CRUD at `/settings/roles` (Business+ `rolePermissions`)
- Permission enforcement wired in team, quotes, messages, nav, billing actions
- **UX refresh (uncommitted, ready to commit):** area-based summaries via `lib/tenant/permissionAreas.ts` — users see “Quotes · View only” instead of raw keys like `quotes.view`; two-tier areas use No access / View only / Full access presets; Team and Settings use expandable capability checklists

**Doc:** `docs/product/custom-roles-permissions.md`

### B4 — Accounting MVP

| Surface               | Route                  |
| --------------------- | ---------------------- |
| Founder summary + CSV | `/accounting` (admin)  |
| Tenant summary + CSV  | `/accounting` (tenant) |

**Doc:** `docs/product/founder-accounting.md`

---

## Migrations to apply

Apply in sequence on DEV then PROD:

1. `0073_platform_support_tickets.sql`
2. `0074_quote_pipeline_stages.sql` — disables expired-quote trigger during backfill
3. `0075_tenant_custom_roles.sql`

Regenerate `lib/supabase/database.types.ts` from the linked project after apply if preferred over manual edits.

---

## Implementation plan todo status (Phase 2)

| Todo ID                | Status        | Notes                                                              |
| ---------------------- | ------------- | ------------------------------------------------------------------ |
| `phase2Tickets`        | **completed** | Platform support tickets (0073)                                    |
| `phase2KanbanRoles`    | **completed** | Pipeline stages (0074) + custom roles (0075) + area-based roles UI |
| `phase2Accounting`     | **completed** | Founder + tenant accounting                                        |
| `phase2Twilio`         | **cancelled** | sent.dm transactional SMS only                                     |
| `phase2PlaidZelle`     | in_progress   | Code shipped; prod keys + QA remain                                |
| `phase2PayrollExports` | **completed** | Reports + compensation rules                                       |

---

## What's next (prioritized backlog)

See `docs/product/implementation-backlog-snapshot.md` for the living backlog. Top items:

1. **Commit + PR** — merge `feat/bucket-b-phase2` → `dev` after review
2. **Apply migrations** 0073–0075 on linked Supabase projects
3. **Plaid prod keys** + bank reports when link active
4. **Tenant customer CSV import** (Jobber-first) — spec only: `docs/product/tenant-customer-import.md`
5. **Customer email** when provider replies (messaging follow-up)
6. **Founder email** on new platform support ticket
7. Platform **`plans` / `plan_features` / `tenant_addons`** DB catalog + add-on checkout
8. **pgsodium / Vault** column encryption
9. RLS CI (pg_tap, ephemeral DB), Playwright in CI, Sentry sourcemaps
10. Phase 3: masquerade polish, PWA, campaign scheduled sends

---

## Key product docs

| Topic                    | Path                                              |
| ------------------------ | ------------------------------------------------- |
| Master plan (YAML todos) | `.cursor/docs/plan/implementation-plan.md`        |
| Backlog snapshot         | `docs/product/implementation-backlog-snapshot.md` |
| Platform support tickets | `docs/product/platform-support-tickets.md`        |
| Quote pipeline stages    | `docs/product/quote-pipeline-stages.md`           |
| Custom roles             | `docs/product/custom-roles-permissions.md`        |
| Accounting               | `docs/product/founder-accounting.md`              |
| Platform outreach        | `docs/product/platform-outreach.md`               |
| Customer messaging       | `docs/product/customer-support-messaging.md`      |
| Tenant reports           | `docs/product/tenant-reports.md`                  |
| Service zones            | `docs/product/service-zones.md`                   |
| Scheduling logic         | `docs/product/schedule-optimizer.md`              |
| Job notes and job types  | `docs/product/job-notes-and-job-types.md`         |
| Time off notifications   | `docs/product/time-off-notifications.md`          |
| Sign-in passkeys and 2FA | `docs/product/sign-in-passkeys-and-mfa.md`        |
| Tenant customer import   | `docs/product/tenant-customer-import.md`          |
| Latency plan             | `docs/performance/interaction-latency-plan.md`    |

---

## Pre-ship checklist (last verified)

```bash
npm run format
npm run lint
npm run lint:styles
npm run typecheck
npm test
npm run build
```

All passed on 2026-06-08 after the roles UI refresh (including `lint:styles` fix for `.srOnly` mixin).
