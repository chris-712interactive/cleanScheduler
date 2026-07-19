# Implementation status summary

**Last updated:** 2026-07-18  
**Branch:** `dev`  
**Latest polish:** Consultation checklists + property notes — per–service-type walkthrough checklists, required service type when booking consultations, notes synced to visit + property `site_notes` — see `docs/product/visit-checklists.md`

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
4. **Customer email** when provider replies (messaging follow-up)
5. **Founder email** on new platform support ticket
6. Platform **`plans` / `plan_features` / `tenant_addons`** DB catalog + add-on checkout
7. **pgsodium / Vault** column encryption
8. RLS CI (pg_tap, ephemeral DB), Playwright in CI, Sentry sourcemaps
9. Phase 3: masquerade polish, PWA, campaign scheduled sends

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
