# Implementation backlog snapshot

**Saved:** 2026-06-08 — handoff snapshot: `docs/product/implementation-status-summary.md`

## Recently shipped (Bucket B — Phase 2)

- **Platform support ticketing** (0073) — founder `/support`, tenant `/settings/support`. See `docs/product/platform-support-tickets.md`.
- **Custom quote pipeline stages** (0074) — Pro+ Kanban customization at `/settings/quotes-pipeline`. See `docs/product/quote-pipeline-stages.md`.
- **Custom roles + permissions** (0075) — `/settings/roles` CRUD (Business+). Area-based permission UX (`lib/tenant/permissionAreas.ts`). See `docs/product/custom-roles-permissions.md`.
- **Accounting MVP** — founder `/accounting`, tenant `/accounting`. See `docs/product/founder-accounting.md`.

**Branch:** `feat/bucket-b-phase2` — committed (`d1e8e8a`); roles UI refresh + `permissionAreas` uncommitted locally, pre-ship checks pass (2026-06-08).

## Explicitly pending (Phase 2/3)

- Masquerade polish — consent flow, per-action audit UI (`phase3MasqueradePolish`)
- PWA / offline field schedule (`phase3Pwa`)
- Customer email when provider replies (messaging follow-up)
- Founder email on new platform support ticket

## In progress / high-value gaps

- Platform **`plans` / `plan_features` / `tenant_addons`** DB catalog + add-on checkout
- Setup Intent / saved PM UX beyond Stripe portal
- Consolidated **cross-tenant customer billing rollup**
- **pgsodium / Vault** column encryption (key ceremony)
- RLS CI (pg_tap, ephemeral DB, masquerade tests)
- Playwright smoke in CI; Sentry release + sourcemaps
- Campaign **scheduled sends** cron
- Plaid prod keys + bank reports when link active ← **current focus**
- Quote pipeline `on_enter_status` exposed in settings UI

## Latency plan (separate track)

Phases 0–4 **code-complete**. Remaining: fill `docs/performance/phase-0-baselines.md` on staging after Phase 4 release.
